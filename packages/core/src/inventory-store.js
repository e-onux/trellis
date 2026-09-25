// Reuse inventory - Node-only storage. Exactly ONE persistent store exists at a time:
//   tech/reuse-index.jsonl   (small; line-oriented, reviewable in Git)
//   tech/reuse-index.sqlite  (after migration; Git-tracked, the single source of truth)
// Both present = an interrupted/diverged migration: reported as `conflict`, never silently resolved.
// The SQLite driver (WASM, no native build, works on Node 18) is loaded lazily, so JSONL-only
// repos and the browser never pay for it. Pure logic lives in inventory.js. See ADR-0008.
import { createRequire } from 'node:module';
import { fs, path } from './util.js';
import { loadConfig, loadAdrs, findCapabilityDirs } from './evidence.js';
import {
  INVENTORY_SCHEMA_VERSION, INVENTORY_STATUSES, INVENTORY_THRESHOLDS, decideStorage, entryPath,
  migrationNotice, normalizeRecord, parseJsonl, searchRecords, searchText, serializeJsonl, sortById,
  tokenize, validateRecord, validateRecords, FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT
} from './inventory.js';

export const INVENTORY_JSONL = 'reuse-index.jsonl';
export const INVENTORY_SQLITE = 'reuse-index.sqlite';
export const INVENTORY_TEMP = '.reuse-index.sqlite.tmp';
const FORMAT_TAG = 'trellis-reuse-inventory';

export class InventoryError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

// ---- locations & state --------------------------------------------------------------------------

export function inventoryPaths(repoRoot) {
  const cfg = loadConfig(repoRoot);
  const dir = path.join(repoRoot, cfg.paths?.tech || 'tech');
  return {
    config: cfg,
    dir,
    jsonl: path.join(dir, INVENTORY_JSONL),
    sqlite: path.join(dir, INVENTORY_SQLITE),
    temp: path.join(dir, INVENTORY_TEMP),
    rel: (p) => path.relative(repoRoot, p).split(path.sep).join('/')
  };
}

/** The module is on unless `.trellis.yaml` sets `modules.reuse_inventory: false`. */
export function inventoryEnabled(cfg) {
  return cfg?.modules?.reuse_inventory !== false;
}

/**
 * Where the inventory lives and what the agent must do next. States:
 * disabled | empty | jsonl | migration_pending | sqlite | conflict.
 * Only `migration_pending` carries the one-time user notice.
 */
export function inventoryStatus(repoRoot, { lang, thresholds = INVENTORY_THRESHOLDS } = {}) {
  repoRoot = path.resolve(repoRoot);
  const p = inventoryPaths(repoRoot);
  const base = { jsonl: p.rel(p.jsonl), sqlite: p.rel(p.sqlite), thresholds, stale_temp: fs.existsSync(p.temp) };
  if (!inventoryEnabled(p.config)) return { ...base, state: 'disabled', enabled: false };
  const hasJ = fs.existsSync(p.jsonl);
  const hasS = fs.existsSync(p.sqlite);
  if (hasJ && hasS) {
    return {
      ...base, state: 'conflict', enabled: true,
      message: 'Both the JSONL and the SQLite inventory exist (interrupted or diverged migration). Trellis will ' +
        'not pick one. Run `trellis inventory recover` - it finishes the migration only if both hold identical ' +
        'records, otherwise choose explicitly with `--keep sqlite|jsonl` after reviewing `trellis inventory diff`.'
    };
  }
  if (hasS) return { ...base, state: 'sqlite', enabled: true, format: 'sqlite', records: sqliteCount(p.sqlite) };
  if (!hasJ) return { ...base, state: 'empty', enabled: true, format: null, records: 0, bytes: 0 };
  const text = fs.readFileSync(p.jsonl, 'utf8');
  const size = { records: text.split('\n').filter((l) => l.trim()).length, bytes: Buffer.byteLength(text) };
  const decision = decideStorage(size, thresholds);
  if (decision.format === 'jsonl') return { ...base, state: 'jsonl', enabled: true, format: 'jsonl', ...size };
  return {
    ...base, state: 'migration_pending', enabled: true, format: 'jsonl', ...size, reasons: decision.reasons,
    notice: migrationNotice(lang),
    next: 'Give the user this notice ONCE, in the language of the conversation, then run: trellis inventory migrate --notified'
  };
}

// ---- SQLite (lazy WASM driver) ------------------------------------------------------------------

let Driver = null;
function sqliteDriver() {
  if (!Driver) {
    const require = createRequire(import.meta.url);
    try {
      Driver = require('node-sqlite3-wasm');
    } catch {
      throw new InventoryError('SQLITE_DRIVER_MISSING', 'The SQLite inventory needs the "node-sqlite3-wasm" package (a dependency of @sidrelabs/trellis-core). Reinstall dependencies.');
    }
  }
  return Driver;
}

export function openSqlite(file, { readOnly = false } = {}) {
  const { Database } = sqliteDriver();
  return new Database(file, { readOnly });
}

export function createSqliteSchema(db) {
  const statuses = INVENTORY_STATUSES.map((s) => `'${s}'`).join(', ');
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE records (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      terms TEXT NOT NULL,
      entry TEXT NOT NULL,
      tests TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (${statuses})),
      capability TEXT,
      adr TEXT,
      search_text TEXT NOT NULL
    ) WITHOUT ROWID;
    PRAGMA user_version = ${INVENTORY_SCHEMA_VERSION};
  `);
  db.run('INSERT INTO meta (key, value) VALUES (?, ?), (?, ?)', ['format', FORMAT_TAG, 'schema_version', String(INVENTORY_SCHEMA_VERSION)]);
}

function rowOf(rec) {
  const r = normalizeRecord(rec);
  return [r.id, r.purpose, JSON.stringify(r.terms), r.entry, JSON.stringify(r.tests), r.status, r.capability ?? null, r.adr ?? null, searchText(r)];
}

function recordOf(row) {
  return normalizeRecord({
    id: row.id, purpose: row.purpose, terms: JSON.parse(row.terms), entry: row.entry,
    tests: JSON.parse(row.tests), status: row.status, capability: row.capability ?? undefined, adr: row.adr ?? undefined
  });
}

const UPSERT = `INSERT INTO records (id, purpose, terms, entry, tests, status, capability, adr, search_text)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET purpose=excluded.purpose, terms=excluded.terms, entry=excluded.entry,
  tests=excluded.tests, status=excluded.status, capability=excluded.capability, adr=excluded.adr,
  search_text=excluded.search_text`;

/** Apply upserts/deletes in one transaction, then VACUUM so the tracked binary stays compact. */
export function sqliteWrite(db, { upsert = [], remove = [], replaceAll = false } = {}) {
  db.exec('BEGIN');
  try {
    if (replaceAll) db.exec('DELETE FROM records');
    for (const id of remove) db.run('DELETE FROM records WHERE id = ?', [id]);
    for (const rec of upsert) db.run(UPSERT, rowOf(rec));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  db.exec('VACUUM');
}

/** Read everything from a SQLite inventory file plus its self-description. */
export function readSqliteFile(file) {
  const db = openSqlite(file, { readOnly: true });
  try {
    const meta = Object.fromEntries(db.all('SELECT key, value FROM meta').map((r) => [r.key, r.value]));
    const userVersion = db.get('PRAGMA user_version').user_version;
    const integrity = db.get('PRAGMA integrity_check').integrity_check;
    const records = db.all('SELECT * FROM records ORDER BY id').map(recordOf);
    return { records, meta, userVersion, integrity };
  } finally {
    db.close();
  }
}

function sqliteCount(file) {
  const db = openSqlite(file, { readOnly: true });
  try { return db.get('SELECT COUNT(*) AS n FROM records').n; } finally { db.close(); }
}

export function assertSqliteSchema(info, where) {
  if (info.meta.format !== FORMAT_TAG || Number(info.meta.schema_version) !== INVENTORY_SCHEMA_VERSION || info.userVersion !== INVENTORY_SCHEMA_VERSION) {
    throw new InventoryError('SCHEMA_MISMATCH', `${where} is not a schema-v${INVENTORY_SCHEMA_VERSION} Trellis inventory (format=${info.meta.format}, schema_version=${info.meta.schema_version}, user_version=${info.userVersion}).`);
  }
}

// ---- loading ------------------------------------------------------------------------------------

/** Load the whole record set from the current single store. Throws on disabled/conflict. */
export function loadInventory(repoRoot) {
  repoRoot = path.resolve(repoRoot);
  const st = inventoryStatus(repoRoot);
  const p = inventoryPaths(repoRoot);
  if (st.state === 'disabled') throw new InventoryError('DISABLED', 'The reuse inventory is disabled (.trellis.yaml modules.reuse_inventory: false).');
  if (st.state === 'conflict') throw new InventoryError('CONFLICT', st.message, { status: st });
  if (st.state === 'empty') return { status: st, source: 'none', records: [], parseErrors: [] };
  if (st.state === 'sqlite') {
    const info = readSqliteFile(p.sqlite);
    assertSqliteSchema(info, st.sqlite);
    return { status: st, source: 'sqlite', records: info.records, parseErrors: [], integrity: info.integrity };
  }
  const { records, errors } = parseJsonl(fs.readFileSync(p.jsonl, 'utf8'));
  return { status: st, source: 'jsonl', records, parseErrors: errors };
}

// ---- find ---------------------------------------------------------------------------------------

/**
 * Bounded search. JSONL is scanned in memory; SQLite pre-filters rows with a superset LIKE on the
 * first three characters of each query token, then both paths rank with the SAME pure scorer, so
 * the result shape and ordering are identical across formats.
 */
export function findInventory(repoRoot, query, { limit = FIND_DEFAULT_LIMIT } = {}) {
  repoRoot = path.resolve(repoRoot);
  const st = inventoryStatus(repoRoot);
  const wrap = (source, res) => ({ state: st.state, source, ...res });
  if (st.state === 'disabled' || st.state === 'conflict') {
    const res = searchRecords([], query, { limit });
    res.hint = st.state === 'conflict' ? st.message : 'The reuse inventory is disabled; search the relevant code area directly.';
    return wrap('none', res);
  }
  if (st.state === 'sqlite') {
    const p = inventoryPaths(repoRoot);
    const toks = [...new Set(tokenize(query))];
    let rows = [];
    if (toks.length) {
      const db = openSqlite(p.sqlite, { readOnly: true });
      try {
        const where = toks.map(() => 'search_text LIKE ?').join(' OR ');
        rows = db.all(`SELECT * FROM records WHERE ${where}`, toks.map((t) => `%${t.slice(0, 3)}%`)).map(recordOf);
      } finally { db.close(); }
    }
    return wrap('sqlite', searchRecords(rows, query, { limit }));
  }
  const inv = loadInventory(repoRoot);
  return wrap(inv.source, searchRecords(inv.records.filter((r) => r && typeof r === 'object'), query, { limit }));
}

export { FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT };

// ---- validation ---------------------------------------------------------------------------------

/** Cross-reference checks: code/test paths exist, capability and ADR ids resolve. */
export function checkInventoryRefs(repoRoot, records) {
  repoRoot = path.resolve(repoRoot);
  const cfg = loadConfig(repoRoot);
  const capIds = new Set(findCapabilityDirs(repoRoot, cfg.paths?.capabilities || 'capabilities').map((d) => path.basename(d)));
  const adrIds = loadAdrs(repoRoot).ids;
  const issues = [];
  const exists = (rel) => fs.existsSync(path.join(repoRoot, rel));
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;
    const id = rec.id || '?';
    if (typeof rec.entry === 'string' && rec.entry && !exists(entryPath(rec.entry))) issues.push({ id, kind: 'missing-entry', message: `entry not found: ${entryPath(rec.entry)}` });
    for (const t of Array.isArray(rec.tests) ? rec.tests : []) {
      if (typeof t === 'string' && t && !exists(t)) issues.push({ id, kind: 'missing-test', message: `test not found: ${t}` });
    }
    if (rec.capability && !capIds.has(rec.capability)) issues.push({ id, kind: 'unknown-capability', message: `capability "${rec.capability}" does not resolve to capabilities/<id>/contract.yaml` });
    if (rec.adr && !adrIds.has(rec.adr)) issues.push({ id, kind: 'unknown-adr', message: `decision "${rec.adr}" does not resolve to an ADR in tech/decisions/` });
  }
  return issues;
}

/** Full validation: store state, parse errors, record shape, duplicates, broken references. */
export function validateInventory(repoRoot) {
  repoRoot = path.resolve(repoRoot);
  const st = inventoryStatus(repoRoot);
  if (st.state === 'disabled') return { state: st.state, evaluated: false, ok: true, count: 0, issues: [] };
  if (st.state === 'conflict') return { state: st.state, evaluated: true, ok: false, count: 0, issues: [{ id: '*', kind: 'conflict', message: st.message }] };
  let inv;
  try {
    inv = loadInventory(repoRoot);
  } catch (e) {
    return { state: st.state, evaluated: true, ok: false, count: 0, issues: [{ id: '*', kind: 'store', message: e.message }] };
  }
  const issues = [];
  for (const e of inv.parseErrors) issues.push({ id: `line ${e.line}`, kind: 'parse', message: e.message });
  if (inv.integrity && inv.integrity !== 'ok') issues.push({ id: '*', kind: 'integrity', message: `SQLite integrity_check: ${inv.integrity}` });
  issues.push(...validateRecords(inv.records));
  issues.push(...checkInventoryRefs(repoRoot, inv.records));
  if (st.stale_temp) issues.push({ id: '*', kind: 'stale-temp', message: `leftover ${INVENTORY_TEMP} from an interrupted migration (safe to delete; the next migrate removes it)` });
  return { state: st.state, evaluated: true, ok: issues.length === 0, count: inv.records.length, issues };
}

// ---- writes -------------------------------------------------------------------------------------

function writableInventory(repoRoot) {
  const inv = loadInventory(repoRoot);
  if (inv.status.state === 'migration_pending') {
    throw new InventoryError('MIGRATION_PENDING', 'The inventory crossed the JSONL threshold. Give the user the migration notice, then run `trellis inventory migrate --notified` before writing.', { status: inv.status });
  }
  if (inv.parseErrors.length) throw new InventoryError('INVALID_STORE', `The JSONL inventory has ${inv.parseErrors.length} unparseable line(s); fix them first (trellis inventory validate).`);
  return inv;
}

function writeJsonlAtomic(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, serializeJsonl(records));
  fs.renameSync(tmp, file);
}

function persist(repoRoot, inv, { upsert = [], remove = [], replaceAll = false }) {
  const p = inventoryPaths(repoRoot);
  if (inv.source === 'sqlite') {
    const db = openSqlite(p.sqlite);
    try { sqliteWrite(db, { upsert, remove, replaceAll }); } finally { db.close(); }
  } else {
    const drop = new Set([...remove, ...upsert.map((r) => r.id)]);
    const base = replaceAll ? [] : inv.records.filter((r) => !drop.has(r.id));
    writeJsonlAtomic(p.jsonl, [...base, ...upsert.map(normalizeRecord)]);
  }
}

function assertWritable(repoRoot, rec) {
  const errs = validateRecord(rec);
  if (errs.length) throw new InventoryError('INVALID_RECORD', `Invalid inventory record: ${errs.join('; ')}`, { errors: errs });
  const refs = checkInventoryRefs(repoRoot, [rec]);
  if (refs.length) throw new InventoryError('BROKEN_REFERENCE', `Record references do not resolve: ${refs.map((r) => r.message).join('; ')}`, { issues: refs });
}

/** Add a verified solution. Returns the new status so callers see a threshold crossing. */
export function addInventoryRecord(repoRoot, record) {
  repoRoot = path.resolve(repoRoot);
  const inv = writableInventory(repoRoot);
  const rec = normalizeRecord({ status: 'active', ...record });
  assertWritable(repoRoot, rec);
  if (inv.records.some((r) => r.id === rec.id)) throw new InventoryError('DUPLICATE_ID', `Inventory id "${rec.id}" already exists; use \`trellis inventory update\`.`);
  persist(repoRoot, inv, { upsert: [rec] });
  return { record: rec, status: inventoryStatus(repoRoot) };
}

/** Patch an existing record (fields set to null are removed). */
export function updateInventoryRecord(repoRoot, id, patch) {
  repoRoot = path.resolve(repoRoot);
  const inv = writableInventory(repoRoot);
  const cur = inv.records.find((r) => r.id === id);
  if (!cur) throw new InventoryError('NOT_FOUND', `No inventory record "${id}".`);
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete next[k]; else if (v !== undefined) next[k] = v; }
  next.id = id;
  const rec = normalizeRecord(next);
  assertWritable(repoRoot, rec);
  persist(repoRoot, inv, { upsert: [rec] });
  return { record: rec, status: inventoryStatus(repoRoot) };
}

export function removeInventoryRecord(repoRoot, id) {
  repoRoot = path.resolve(repoRoot);
  const inv = writableInventory(repoRoot);
  if (!inv.records.some((r) => r.id === id)) throw new InventoryError('NOT_FOUND', `No inventory record "${id}".`);
  persist(repoRoot, inv, { remove: [id] });
  return { removed: id, status: inventoryStatus(repoRoot) };
}

/** Replace the whole record set in the current store (used by `merge`). */
export function replaceInventoryRecords(repoRoot, records) {
  repoRoot = path.resolve(repoRoot);
  const inv = writableInventory(repoRoot);
  const issues = validateRecords(records);
  if (issues.length) throw new InventoryError('INVALID_RECORD', `Merged set is invalid: ${issues.map((i) => `${i.id}: ${i.message}`).join('; ')}`);
  persist(repoRoot, inv, { upsert: sortById(records), replaceAll: true });
  return inventoryStatus(repoRoot);
}
