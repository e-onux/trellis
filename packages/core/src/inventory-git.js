// Reuse inventory - Git review and merge of the store. The SQLite file is binary, so reviewers get a
// record-level diff (`trellis inventory diff`) and parallel branches get a record-level three-way
// merge (`trellis inventory merge`) instead of a second, persistent text copy. Reads any ref in
// either format, so a diff across the JSONL → SQLite migration shows only real record changes.
// Node-only. See ADR-0008.
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { fs, path } from './util.js';
import { diffRecords, mergeRecords, parseJsonl, sortById } from './inventory.js';
import {
  INVENTORY_SQLITE, InventoryError, assertSqliteSchema, inventoryPaths, loadInventory, readSqliteFile,
  replaceInventoryRecords
} from './inventory-store.js';

function gitShow(repoRoot, ref, rel) {
  try {
    return execFileSync('git', ['show', `${ref}:./${rel}`], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return null;
  }
}

export function gitRev(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Records as they were at a Git ref, whichever format the ref used. */
export function readInventoryAtRef(repoRoot, ref) {
  repoRoot = path.resolve(repoRoot);
  try {
    gitRev(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    throw new InventoryError('UNKNOWN_REF', `"${ref}" is not a commit in this repository.`);
  }
  const p = inventoryPaths(repoRoot);
  const sqliteBuf = gitShow(repoRoot, ref, p.rel(p.sqlite));
  const jsonlBuf = gitShow(repoRoot, ref, p.rel(p.jsonl));
  if (sqliteBuf && jsonlBuf) throw new InventoryError('CONFLICT', `${ref} contains both ${p.rel(p.jsonl)} and ${p.rel(p.sqlite)}.`);
  if (sqliteBuf) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-inv-'));
    const file = path.join(tmpDir, INVENTORY_SQLITE);
    try {
      fs.writeFileSync(file, sqliteBuf);
      const info = readSqliteFile(file);
      assertSqliteSchema(info, `${ref}:${p.rel(p.sqlite)}`);
      return { source: 'sqlite', records: info.records };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  if (jsonlBuf) return { source: 'jsonl', records: parseJsonl(jsonlBuf.toString('utf8')).records };
  return { source: 'none', records: [] };
}

// ---- review & merge of the binary store ---------------------------------------------------------

/**
 * Readable, record-level diff between two points: a Git ref, or the working tree (`to` omitted).
 * Works across the migration (a JSONL ref vs a SQLite ref) because both sides are read as records.
 */
export function diffInventory(repoRoot, { from = 'HEAD', to } = {}) {
  repoRoot = path.resolve(repoRoot);
  const before = readInventoryAtRef(repoRoot, from);
  const after = to ? readInventoryAtRef(repoRoot, to) : loadInventory(repoRoot);
  return { from, to: to || 'working tree', fromSource: before.source, toSource: after.source, ...diffRecords(before.records, after.records) };
}

/**
 * Record-level three-way merge of another branch's inventory into the working tree. Used when two
 * branches both changed the binary SQLite file: keep ours in the index, then run this against the
 * other branch. Writes only when there are no conflicts (or `prefer` settles them).
 * @param {{ prefer?: 'ours'|'theirs', dryRun?: boolean }} opts
 */
export function mergeInventory(repoRoot, theirsRef, { prefer, dryRun = false } = {}) {
  repoRoot = path.resolve(repoRoot);
  const theirs = readInventoryAtRef(repoRoot, theirsRef).records;
  const baseRef = gitRev(repoRoot, ['merge-base', 'HEAD', theirsRef]);
  const base = readInventoryAtRef(repoRoot, baseRef).records;
  const ours = loadInventory(repoRoot).records;
  const res = mergeRecords(base, ours, theirs);
  let records = res.records;
  if (res.conflicts.length && prefer === 'theirs') {
    const pick = new Map(res.conflicts.map((c) => [c.id, c.theirs]));
    records = sortById([...records.filter((r) => !pick.has(r.id)), ...[...pick.values()].filter(Boolean)]);
  }
  const blocked = res.conflicts.length > 0 && !prefer;
  const changes = diffRecords(ours, records);
  if (!blocked && !dryRun) replaceInventoryRecords(repoRoot, records);
  return { base: baseRef, theirs: theirsRef, conflicts: res.conflicts, written: !blocked && !dryRun, changes };
}
