// Reuse inventory - the one-way JSONL → SQLite format migration, and recovery from an interrupted one.
// Order is what makes it safe to re-run: build a TEMP database next to the target, verify it
// (schema version, count, ids, content, references, PRAGMA integrity_check), atomically rename it
// into place, and only then delete the JSONL. Any failure before the rename leaves the JSONL untouched.
// A crash between rename and delete leaves both files → `conflict`, resolved only by `recoverInventory`.
// Node-only. See ADR-0008.
import { fs } from './util.js';
import { INVENTORY_SCHEMA_VERSION, diffRecords, parseJsonl, recordsEqual, sortById, validateRecords } from './inventory.js';
import {
  InventoryError, createSqliteSchema, inventoryPaths, inventoryStatus, openSqlite, readSqliteFile, sqliteWrite
} from './inventory-store.js';

const REF_FIELDS = ['entry', 'tests', 'capability', 'adr'];

/** Compare a freshly written SQLite file against the source records. Returns named checks. */
export function verifySqliteCopy(file, source) {
  const info = readSqliteFile(file);
  const want = sortById(source);
  const got = info.records;
  const wantIds = want.map((r) => r.id);
  const gotIds = got.map((r) => r.id);
  const byId = new Map(got.map((r) => [r.id, r]));
  const contentDiff = want.filter((r) => !byId.has(r.id) || !recordsEqual(r, byId.get(r.id))).map((r) => r.id);
  const refDiff = want.filter((r) => {
    const g = byId.get(r.id);
    return !g || REF_FIELDS.some((k) => JSON.stringify(r[k] ?? null) !== JSON.stringify(g[k] ?? null));
  }).map((r) => r.id);
  const checks = [
    { check: 'schema_version', ok: Number(info.meta.schema_version) === INVENTORY_SCHEMA_VERSION && info.userVersion === INVENTORY_SCHEMA_VERSION, detail: `meta=${info.meta.schema_version} user_version=${info.userVersion}` },
    { check: 'record_count', ok: got.length === want.length, detail: `${got.length}/${want.length}` },
    { check: 'ids', ok: JSON.stringify(gotIds) === JSON.stringify(wantIds), detail: `${gotIds.length} ids` },
    { check: 'content', ok: contentDiff.length === 0, detail: contentDiff.length ? `differs: ${contentDiff.slice(0, 5).join(', ')}` : 'identical' },
    { check: 'references', ok: refDiff.length === 0, detail: refDiff.length ? `differs: ${refDiff.slice(0, 5).join(', ')}` : 'identical' },
    { check: 'integrity_check', ok: info.integrity === 'ok', detail: info.integrity }
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

function buildTempDb(file, records) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}-journal`, { force: true });
  const db = openSqlite(file);
  try {
    createSqliteSchema(db);
    sqliteWrite(db, { upsert: sortById(records) });
  } finally {
    db.close();
  }
}

/**
 * Migrate the JSONL inventory into SQLite.
 * @param {object} opts
 * @param {boolean} opts.notified  the agent has ALREADY given the user the one-time notice
 * @param {boolean} [opts.force]   migrate even though the threshold is not crossed
 * @param {string}  [opts.faultAt] test hook: 'build' | 'verify' | 'before-rename' | 'before-delete'
 */
export function migrateInventory(repoRoot, { notified = false, force = false, faultAt } = {}) {
  const st = inventoryStatus(repoRoot);
  const p = inventoryPaths(repoRoot);
  if (st.state === 'disabled') throw new InventoryError('DISABLED', 'The reuse inventory is disabled.');
  if (st.state === 'conflict') throw new InventoryError('CONFLICT', st.message, { status: st });
  if (st.state === 'sqlite') return { migrated: false, state: 'sqlite', message: 'Already on SQLite; nothing to do.' };
  if (st.state === 'empty') throw new InventoryError('EMPTY', 'There is no JSONL inventory to migrate.');
  if (st.state === 'jsonl' && !force) {
    throw new InventoryError('BELOW_THRESHOLD', `The inventory is below the migration threshold (${st.records} records, ${st.bytes} bytes); pass --force to migrate anyway.`);
  }
  if (!notified) {
    const s = st.notice ? st : inventoryStatus(repoRoot, { thresholds: { records: 0, bytes: 0 } });
    throw new InventoryError('NOTICE_REQUIRED', 'Tell the user the migration notice first (once, in their language), then re-run with --notified.', { notice: s.notice });
  }

  // 1) Read and validate the source. Nothing is written if it is broken.
  const { records, errors } = parseJsonl(fs.readFileSync(p.jsonl, 'utf8'));
  const issues = validateRecords(records);
  if (errors.length || issues.length) {
    throw new InventoryError('INVALID_SOURCE', `JSONL inventory is invalid (${errors.length} parse error(s), ${issues.length} record issue(s)); fix it with \`trellis inventory validate\` before migrating. The JSONL was not modified.`, { errors, issues });
  }

  // 2) Build and verify a temp database next to the target (same filesystem → atomic rename).
  let verification;
  try {
    if (faultAt === 'build') throw new Error('injected fault while building');
    buildTempDb(p.temp, records);
    verification = verifySqliteCopy(p.temp, faultAt === 'verify' ? records.slice(1) : records);
  } catch (e) {
    fs.rmSync(p.temp, { force: true });
    throw new InventoryError('BUILD_FAILED', `Building the SQLite inventory failed: ${e.message}. The JSONL was not modified.`);
  }
  if (!verification.ok) {
    fs.rmSync(p.temp, { force: true });
    throw new InventoryError('VERIFY_FAILED', `Verification failed (${verification.checks.filter((c) => !c.ok).map((c) => c.check).join(', ')}). The JSONL was not modified.`, { checks: verification.checks });
  }
  if (faultAt === 'before-rename') throw new InventoryError('INTERRUPTED', 'injected interruption before rename');

  // 3) Commit point: rename, then remove the old format. SQLite is now the single source of truth.
  fs.renameSync(p.temp, p.sqlite);
  if (faultAt === 'before-delete') throw new InventoryError('INTERRUPTED', 'injected interruption before deleting the JSONL');
  fs.rmSync(p.jsonl);
  return { migrated: true, state: 'sqlite', records: records.length, checks: verification.checks, removed: p.rel(p.jsonl), sqlite: p.rel(p.sqlite) };
}

/**
 * Resolve a `conflict` (both files present). Finishes an interrupted migration only when the SQLite
 * copy verifies against the JSONL exactly; otherwise the caller must choose with `keep`.
 * @param {{ keep?: 'sqlite'|'jsonl' }} opts
 */
export function recoverInventory(repoRoot, { keep } = {}) {
  const st = inventoryStatus(repoRoot);
  const p = inventoryPaths(repoRoot);
  if (st.state !== 'conflict') {
    if (st.stale_temp) fs.rmSync(p.temp, { force: true });
    return { resolved: false, state: st.state, message: st.stale_temp ? `Removed a stale ${p.rel(p.temp)}.` : 'Nothing to recover.' };
  }
  const { records, errors } = parseJsonl(fs.readFileSync(p.jsonl, 'utf8'));
  let verification = { ok: false, checks: [] };
  let sqliteRecords = [];
  try {
    verification = errors.length ? verification : verifySqliteCopy(p.sqlite, records);
    sqliteRecords = readSqliteFile(p.sqlite).records;
  } catch (e) {
    verification.checks.push({ check: 'open', ok: false, detail: e.message });
  }
  if (!keep && verification.ok) {
    fs.rmSync(p.jsonl);
    fs.rmSync(p.temp, { force: true });
    return { resolved: true, action: 'completed-migration', state: 'sqlite', checks: verification.checks };
  }
  if (keep === 'sqlite') { fs.rmSync(p.jsonl); fs.rmSync(p.temp, { force: true }); return { resolved: true, action: 'kept-sqlite', state: 'sqlite' }; }
  if (keep === 'jsonl') { fs.rmSync(p.sqlite); fs.rmSync(p.temp, { force: true }); return { resolved: true, action: 'kept-jsonl', state: inventoryStatus(repoRoot).state }; }
  throw new InventoryError('DIVERGED', 'The JSONL and SQLite inventories differ; review the difference and re-run with --keep sqlite|jsonl.', {
    diff: diffRecords(records, sqliteRecords), checks: verification.checks
  });
}
