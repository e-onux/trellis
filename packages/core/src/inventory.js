// Reuse inventory - pure, browser-safe logic (NO Node APIs). The inventory is a short index of
// solutions that are expensive to build and valuable to reuse, so an agent can find an existing
// algorithm before re-writing it. Storage (JSONL → SQLite), filesystem and git access live in
// inventory-store.js / inventory-migrate.js; this module only shapes, validates and ranks records.
// See tech/decisions/ADR-0008-reuse-inventory.md.

export const INVENTORY_SCHEMA_VERSION = 1;
export const INVENTORY_STATUSES = ['active', 'experimental', 'deprecated'];
export const INVENTORY_FIELDS = ['id', 'purpose', 'terms', 'entry', 'tests', 'status', 'capability', 'adr'];

// Kept deliberately small: a record is a pointer to code, not a copy of its contract or comments.
export const INVENTORY_LIMITS = { purpose: 160, terms: 12, term: 40, tests: 5, path: 200 };

// Result bounds for `find` - an agent never receives the whole inventory.
export const FIND_DEFAULT_LIMIT = 3;
export const FIND_MAX_LIMIT = 5;

// Switch from JSONL to SQLite when EITHER bound is crossed. Measured, not guessed - see
// ADR-0008 and packages/core/bench/inventory-threshold.js for the numbers behind them.
export const INVENTORY_THRESHOLDS = { records: 400, bytes: 128 * 1024 };

const ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ADR_RE = /^ADR-\d{4}$/;
const CAP_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const cleanPath = (p) => String(p).replace(/\\/g, '/');

/** Strip an optional `#symbol` suffix from an entry point. */
export function entryPath(entry) {
  return cleanPath(String(entry).split('#')[0]);
}

function checkPath(errors, field, p) {
  if (!isStr(p)) { errors.push(`${field} must be a non-empty path`); return; }
  const bare = entryPath(p);
  if (bare.length > INVENTORY_LIMITS.path) errors.push(`${field} is longer than ${INVENTORY_LIMITS.path} characters`);
  if (bare.startsWith('/') || /^[A-Za-z]:/.test(bare) || bare.split('/').includes('..')) {
    errors.push(`${field} must be a repository-relative path (got "${p}")`);
  }
}

/**
 * Shape-check one record. Unknown fields are rejected on purpose: they are how contracts and
 * code comments leak into the index and turn it into a second, drifting copy.
 * @returns {string[]} errors (empty when valid)
 */
export function validateRecord(rec) {
  const errors = [];
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return ['record must be a JSON object'];
  for (const k of Object.keys(rec)) if (!INVENTORY_FIELDS.includes(k)) errors.push(`unknown field "${k}"`);
  if (!isStr(rec.id) || !ID_RE.test(rec.id)) errors.push('id must be lowercase kebab/dotted (e.g. "text.fuzzy-match")');
  if (!isStr(rec.purpose)) errors.push('purpose is required');
  else if (rec.purpose.length > INVENTORY_LIMITS.purpose) errors.push(`purpose exceeds ${INVENTORY_LIMITS.purpose} characters - keep it one short sentence`);
  if (!Array.isArray(rec.terms) || rec.terms.length === 0) errors.push('terms must be a non-empty array of search terms/synonyms');
  else {
    if (rec.terms.length > INVENTORY_LIMITS.terms) errors.push(`terms has more than ${INVENTORY_LIMITS.terms} entries`);
    for (const t of rec.terms) {
      if (!isStr(t) || t.length > INVENTORY_LIMITS.term) errors.push(`term "${t}" must be a string of 1-${INVENTORY_LIMITS.term} characters`);
    }
  }
  checkPath(errors, 'entry', rec.entry);
  if (!Array.isArray(rec.tests) || rec.tests.length === 0) errors.push('tests must list at least one test path (only verified solutions belong here)');
  else {
    if (rec.tests.length > INVENTORY_LIMITS.tests) errors.push(`tests has more than ${INVENTORY_LIMITS.tests} entries`);
    rec.tests.forEach((t, i) => checkPath(errors, `tests[${i}]`, t));
  }
  if (!INVENTORY_STATUSES.includes(rec.status)) errors.push(`status must be one of ${INVENTORY_STATUSES.join(', ')}`);
  if (rec.capability !== undefined && (!isStr(rec.capability) || !CAP_RE.test(rec.capability))) errors.push('capability must be a kebab-case capability id');
  if (rec.adr !== undefined && (!isStr(rec.adr) || !ADR_RE.test(rec.adr))) errors.push('adr must look like ADR-0001');
  return errors;
}

/** Canonical form: fixed key order, optional keys omitted when empty. Used for storage and equality. */
export function normalizeRecord(rec) {
  const out = {};
  for (const k of INVENTORY_FIELDS) {
    const v = rec[k];
    if (v === undefined || v === null || v === '') continue;
    out[k] = Array.isArray(v) ? v.map((x) => (k === 'tests' ? cleanPath(x) : String(x))) : (k === 'entry' ? cleanPath(v) : v);
  }
  return out;
}

export function recordsEqual(a, b) {
  return JSON.stringify(normalizeRecord(a)) === JSON.stringify(normalizeRecord(b));
}

/** Validate a whole record set: per-record shape + duplicate ids. */
export function validateRecords(records) {
  const issues = [];
  const seen = new Map();
  records.forEach((rec, i) => {
    const where = rec && rec.id ? rec.id : `#${i + 1}`;
    for (const e of validateRecord(rec)) issues.push({ id: where, kind: 'invalid', message: e });
    if (rec && isStr(rec.id)) {
      if (seen.has(rec.id)) issues.push({ id: rec.id, kind: 'duplicate', message: `duplicate id (also record #${seen.get(rec.id) + 1})` });
      else seen.set(rec.id, i);
    }
  });
  return issues;
}

/**
 * Parse JSONL text. Blank lines are ignored; each broken line is reported with its line number
 * instead of aborting, so validation can list every problem at once.
 */
export function parseJsonl(text) {
  const records = [];
  const errors = [];
  String(text).split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try { records.push(JSON.parse(line)); } catch (e) { errors.push({ line: i + 1, message: `invalid JSON: ${e.message}` }); }
  });
  return { records, errors };
}

/** One record per line, sorted by id - line-oriented so Git diffs and merges stay readable. */
export function serializeJsonl(records) {
  return sortById(records).map((r) => JSON.stringify(normalizeRecord(r))).join('\n') + (records.length ? '\n' : '');
}

export function sortById(records) {
  return [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Decide where the inventory should live given its current size. */
export function decideStorage({ records, bytes }, thresholds = INVENTORY_THRESHOLDS) {
  const reasons = [];
  if (records >= thresholds.records) reasons.push(`${records} records ≥ ${thresholds.records}`);
  if (bytes >= thresholds.bytes) reasons.push(`${bytes} bytes ≥ ${thresholds.bytes}`);
  return { format: reasons.length ? 'sqlite' : 'jsonl', reasons };
}

// ---- search -------------------------------------------------------------------------------------

/** Lowercase, strip diacritics, fold Turkish dotless i; split on anything that is not a letter/digit. */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

/** Flat, normalized text used by the SQLite pre-filter (never shown to the agent). */
export function searchText(rec) {
  return tokenize([rec.id, ...(rec.terms || []), rec.purpose].join(' ')).join(' ');
}

/**
 * Score one record against query tokens. Returns null when nothing matched.
 * Weights: id token 5, exact term 4, partial term 2, purpose word 1. Deprecated records are
 * still returned (so the agent learns the solution was retired) but ranked below live ones.
 */
export function scoreRecord(rec, qTokens) {
  const idT = new Set(tokenize(rec.id));
  const termT = (rec.terms || []).map((t) => ({ raw: t, toks: tokenize(t) }));
  const purT = new Set(tokenize(rec.purpose));
  let score = 0;
  const reasons = [];
  for (const q of qTokens) {
    if (idT.has(q)) { score += 5; reasons.push(`id:${q}`); continue; }
    const exact = termT.find((t) => t.toks.includes(q));
    if (exact) { score += 4; reasons.push(`term:${exact.raw}`); continue; }
    const partial = q.length >= 3 && termT.find((t) => t.toks.some((x) => x.startsWith(q) || (x.length >= 3 && q.startsWith(x))));
    if (partial) { score += 2; reasons.push(`term~${partial.raw}`); continue; }
    if (purT.has(q)) { score += 1; reasons.push(`purpose:${q}`); }
  }
  if (!score) return null;
  if (rec.status === 'deprecated') score = score / 4;
  return { score, reasons };
}

const NO_MATCH_HINT = 'No inventory match. This does NOT mean the project has no solution - search the ' +
  'relevant code area (file names, symbols, tests) before writing new code.';
const MATCH_HINT = 'Candidates only. Open the entry and its tests to confirm behavior before reusing.';

/**
 * Rank records and return the SAME bounded result shape regardless of storage format.
 * @returns {{ query, results: Array, total_matches: number, truncated: boolean, hint: string }}
 */
export function searchRecords(records, query, { limit = FIND_DEFAULT_LIMIT } = {}) {
  const cap = Math.max(1, Math.min(Number(limit) || FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT));
  const qTokens = [...new Set(tokenize(query))];
  const scored = [];
  if (qTokens.length) {
    for (const rec of records) {
      const s = scoreRecord(rec, qTokens);
      if (s) scored.push({ rec, ...s });
    }
  }
  scored.sort((a, b) => b.score - a.score || (a.rec.id < b.rec.id ? -1 : 1));
  const results = scored.slice(0, cap).map(({ rec, score, reasons }) => {
    const r = { id: rec.id, purpose: rec.purpose, status: rec.status, entry: rec.entry, tests: rec.tests };
    if (rec.capability) r.capability = rec.capability;
    if (rec.adr) r.adr = rec.adr;
    r.score = Math.round(score * 100) / 100;
    r.matched = reasons;
    return r;
  });
  return {
    query: String(query),
    results,
    total_matches: scored.length,
    truncated: scored.length > results.length,
    hint: results.length ? MATCH_HINT : NO_MATCH_HINT
  };
}

// ---- diff & three-way merge (record level) ------------------------------------------------------

/** Record-level diff: what a reviewer needs instead of a binary blob. */
export function diffRecords(before, after) {
  const a = new Map(before.map((r) => [r.id, normalizeRecord(r)]));
  const b = new Map(after.map((r) => [r.id, normalizeRecord(r)]));
  const added = [], removed = [], changed = [];
  for (const [id, rec] of b) if (!a.has(id)) added.push(rec);
  for (const [id, rec] of a) if (!b.has(id)) removed.push(rec);
  for (const [id, rec] of b) {
    const old = a.get(id);
    if (!old || JSON.stringify(old) === JSON.stringify(rec)) continue;
    const fields = [];
    for (const k of INVENTORY_FIELDS) {
      if (JSON.stringify(old[k]) !== JSON.stringify(rec[k])) fields.push({ field: k, before: old[k], after: rec[k] });
    }
    changed.push({ id, fields });
  }
  const byId = (x, y) => ((x.id < y.id) ? -1 : 1);
  return { added: added.sort(byId), removed: removed.sort(byId), changed: changed.sort(byId) };
}

/** Human-readable diff lines (`+` added, `-` removed, `~` changed field). */
export function formatDiff(d) {
  const lines = [];
  for (const r of d.added) lines.push(`+ ${r.id}  ${r.purpose}  [${r.entry}]`);
  for (const r of d.removed) lines.push(`- ${r.id}  ${r.purpose}`);
  for (const c of d.changed) {
    for (const f of c.fields) lines.push(`~ ${c.id}.${f.field}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.after)}`);
  }
  return lines;
}

/**
 * Three-way merge at record granularity (for parallel branches that both touched the binary
 * SQLite file). A record changed on only one side takes that side; changed identically on both
 * sides merges cleanly; changed differently on both sides is a conflict the human resolves.
 */
export function mergeRecords(base, ours, theirs) {
  const B = new Map(base.map((r) => [r.id, normalizeRecord(r)]));
  const O = new Map(ours.map((r) => [r.id, normalizeRecord(r)]));
  const T = new Map(theirs.map((r) => [r.id, normalizeRecord(r)]));
  const key = (r) => (r ? JSON.stringify(r) : null);
  const merged = [];
  const conflicts = [];
  for (const id of new Set([...B.keys(), ...O.keys(), ...T.keys()])) {
    const b = key(B.get(id)), o = key(O.get(id)), t = key(T.get(id));
    let pick;
    if (o === t) pick = o;
    else if (o === b) pick = t;
    else if (t === b) pick = o;
    else { conflicts.push({ id, ours: O.get(id) || null, theirs: T.get(id) || null }); pick = o; }
    if (pick) merged.push(JSON.parse(pick));
  }
  return { records: sortById(merged), conflicts: conflicts.sort((x, y) => (x.id < y.id ? -1 : 1)) };
}

// ---- the one-time migration notice --------------------------------------------------------------

// Given to the user in their language immediately BEFORE migration starts - never after, never per
// query. Savings come from returning only short, relevant results, not from SQLite itself.
export const MIGRATION_NOTICES = {
  tr: 'Yazılım envanteri büyüdü. Bundan sonraki aramalarda yalnız ilgili kayıtları gösterip token ' +
    'kullanımını düşük tutmak için envanteri repo içindeki bir SQLite veritabanına taşıyorum. ' +
    'Aktarımı doğruladıktan sonra eski JSONL dosyasını kaldıracağım.',
  en: 'The software inventory has grown. To keep later searches showing only the relevant records and ' +
    'token use low, I am moving the inventory into a SQLite database inside the repository. After ' +
    'verifying the transfer I will remove the old JSONL file.'
};

/** Notice text for a language; unknown languages get English plus an instruction to translate. */
export function migrationNotice(lang) {
  const key = String(lang || '').toLowerCase().split(/[-_]/)[0];
  if (MIGRATION_NOTICES[key]) return { lang: key, text: MIGRATION_NOTICES[key], translate: false };
  return { lang: 'en', text: MIGRATION_NOTICES.en, translate: true };
}
