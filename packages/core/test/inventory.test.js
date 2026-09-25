// Reuse inventory (ADR-0008): search, threshold, migration notice, JSONL → SQLite migration,
// failure safety, validation, disabled module, readable diff and record-level merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  audit, composeAgentsMd, composeAgentPointer, decideStorage, searchRecords, validateRecord, serializeJsonl,
  inventoryStatus, findInventory, validateInventory, addInventoryRecord, updateInventoryRecord, loadInventory,
  migrateInventory, recoverInventory, diffInventory, mergeInventory, formatDiff, migrationNotice,
  INVENTORY_THRESHOLDS, FIND_MAX_LIMIT, MIGRATION_NOTICES, REUSE_INVENTORY_SECTION
} from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '..', '..', 'cli', 'bin', 'trellis.js');

// ---- fixtures -----------------------------------------------------------------------------------

function rec(i, extra = {}) {
  return {
    id: `algo.item-${String(i).padStart(4, '0')}`,
    purpose: `Reusable routine number ${i}.`,
    terms: [`topic${i}`],
    entry: 'src/a.js#run',
    tests: ['test/a.test.js'],
    status: 'active',
    ...extra
  };
}

const FUZZY = {
  id: 'text.fuzzy-match',
  purpose: 'Rank candidate strings by edit distance with a Unicode-aware tokenizer.',
  terms: ['levenshtein', 'edit distance', 'fuzzy search', 'benzerlik'],
  entry: 'src/a.js#fuzzyMatch',
  tests: ['test/a.test.js'],
  status: 'active',
  capability: 'demo-cap',
  adr: 'ADR-0001'
};
const ROUTE = {
  id: 'geo.shortest-path',
  purpose: 'Dijkstra shortest path over a weighted adjacency list.',
  terms: ['dijkstra', 'routing', 'graph search'],
  entry: 'src/b.js',
  tests: ['test/b.test.js'],
  status: 'active'
};

function makeRepo({ modules = 'reuse_inventory: true', records } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-inv-'));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  w('.trellis.yaml', `modules:\n  ${modules}\n`);
  w('tech/decisions/ADR-0001-x.md', '# ADR-0001\n\n```yaml\nid: ADR-0001\ntitle: x\nstatus: accepted\n```\n');
  w('capabilities/demo-cap/contract.yaml', 'id: demo-cap\n');
  for (const f of ['src/a.js', 'src/b.js', 'test/a.test.js', 'test/b.test.js']) w(f, '// fixture\n');
  if (records) w('tech/reuse-index.jsonl', serializeJsonl(records));
  return root;
}

const jsonlPath = (root) => path.join(root, 'tech', 'reuse-index.jsonl');
const sqlitePath = (root) => path.join(root, 'tech', 'reuse-index.sqlite');
const exists = (p) => fs.existsSync(p);
const small = { records: 3, bytes: 1e9 };

function git(root, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function cli(root, ...args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [CLI, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

// ---- search -------------------------------------------------------------------------------------

test('small JSONL inventory: find returns a short, explained candidate with code/test paths', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  const r = findInventory(root, 'levenshtein distance');
  assert.equal(r.source, 'jsonl');
  assert.equal(r.results.length, 1);
  const [hit] = r.results;
  assert.equal(hit.id, 'text.fuzzy-match');
  assert.equal(hit.entry, 'src/a.js#fuzzyMatch');
  assert.deepEqual(hit.tests, ['test/a.test.js']);
  assert.ok(hit.matched.includes('term:levenshtein'));
  assert.deepEqual(Object.keys(hit).sort(), ['adr', 'capability', 'entry', 'id', 'matched', 'purpose', 'score', 'status', 'tests']);
  // diacritic/case folding: "Dijkstra" and a Turkish synonym both hit
  assert.equal(findInventory(root, 'DIJKSTRA').results[0].id, 'geo.shortest-path');
  assert.equal(findInventory(root, 'benzerlik').results[0].id, 'text.fuzzy-match');
});

test('no match is not "no solution": the hint sends the agent to a targeted code search', () => {
  const empty = makeRepo();
  const e = findInventory(empty, 'rate limiter');
  assert.equal(e.state, 'empty');
  assert.equal(e.results.length, 0);
  assert.match(e.hint, /does NOT mean the project has no solution/);
  const miss = findInventory(makeRepo({ records: [FUZZY] }), 'token bucket');
  assert.equal(miss.results.length, 0);
  assert.match(miss.hint, /search the relevant code area/);
});

test('results are bounded: default 3, hard cap 5, truncation reported, never the whole inventory', () => {
  const many = Array.from({ length: 40 }, (_, i) => rec(i, { terms: ['sorting', `topic${i}`] }));
  const d = searchRecords(many, 'sorting');
  assert.equal(d.results.length, 3);
  assert.equal(d.total_matches, 40);
  assert.equal(d.truncated, true);
  assert.equal(searchRecords(many, 'sorting', { limit: 100 }).results.length, FIND_MAX_LIMIT);
  assert.ok(JSON.stringify(searchRecords(many, 'sorting', { limit: 100 })).length < 2000);
});

// ---- threshold & notice -------------------------------------------------------------------------

test('threshold decision: either the record count or the byte size triggers SQLite', () => {
  assert.equal(decideStorage({ records: 10, bytes: 1000 }).format, 'jsonl');
  assert.equal(decideStorage({ records: INVENTORY_THRESHOLDS.records, bytes: 10 }).format, 'sqlite');
  assert.equal(decideStorage({ records: 1, bytes: INVENTORY_THRESHOLDS.bytes }).format, 'sqlite');
  const root = makeRepo({ records: Array.from({ length: INVENTORY_THRESHOLDS.records }, (_, i) => rec(i)) });
  assert.equal(inventoryStatus(root).state, 'migration_pending');
  assert.equal(inventoryStatus(makeRepo({ records: [FUZZY] })).state, 'jsonl');
});

test('migration notice: in the user language, only right before migrating, exactly once', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  // below threshold: no notice anywhere
  assert.equal(inventoryStatus(root, { lang: 'tr', thresholds: small }).notice, undefined);
  assert.equal(findInventory(root, 'dijkstra').notice, undefined);

  // crossing the threshold
  const st = inventoryStatus(root, { lang: 'tr', thresholds: { records: 2, bytes: 1e9 } });
  assert.equal(st.state, 'migration_pending');
  assert.equal(st.notice.text, MIGRATION_NOTICES.tr);
  assert.match(st.notice.text, /SQLite veritabanına taşıyorum/);
  assert.match(st.next, /before|then run: trellis inventory migrate --notified/);
  assert.equal(migrationNotice('en-US').lang, 'en');
  assert.equal(migrationNotice('de').translate, true);
  // the notice does not claim SQLite itself saves tokens
  assert.doesNotMatch(MIGRATION_NOTICES.en, /SQLite (saves|reduces)/i);
});

test('CLI: add crosses the threshold → notice once; migrate refuses until notified; silent afterwards', () => {
  const records = Array.from({ length: INVENTORY_THRESHOLDS.records - 1 }, (_, i) => rec(i));
  const root = makeRepo({ records });
  const before = fs.readFileSync(jsonlPath(root), 'utf8');

  const found = cli(root, 'inventory', 'find', 'topic5');
  assert.equal(found.code, 0);
  assert.doesNotMatch(found.out, /Migration notice/);

  const add = cli(root, 'inventory', 'add', '--record', JSON.stringify(FUZZY));
  assert.equal(add.code, 0, add.out);
  assert.equal((add.out.match(/Migration notice/g) || []).length, 1);

  // querying while pending does not repeat the notice
  assert.doesNotMatch(cli(root, 'inventory', 'find', 'levenshtein').out, /Migration notice/);

  // writes wait for the migration; migrate refuses before the notice was given (exit 3)
  assert.equal(cli(root, 'inventory', 'add', '--record', JSON.stringify(ROUTE)).code, 1);
  const refused = cli(root, 'inventory', 'migrate');
  assert.equal(refused.code, 3);
  assert.match(refused.out, /NOTICE_REQUIRED/);
  assert.ok(exists(jsonlPath(root)) && !exists(sqlitePath(root)));
  assert.notEqual(fs.readFileSync(jsonlPath(root), 'utf8'), before); // the add itself landed

  const done = cli(root, 'inventory', 'migrate', '--notified');
  assert.equal(done.code, 0, done.out);
  assert.doesNotMatch(done.out, /Migration notice/);
  assert.ok(!exists(jsonlPath(root)) && exists(sqlitePath(root)));
  assert.doesNotMatch(cli(root, 'inventory', 'status').out, /Migration notice/);
  assert.match(cli(root, 'inventory', 'migrate', '--notified').out, /Already on SQLite/);
});

// ---- migration ----------------------------------------------------------------------------------

test('successful migration: verified copy, JSONL removed, all reads and writes go to SQLite', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  const jsonlBefore = loadInventory(root).records;
  const r = migrateInventory(root, { notified: true, force: true });
  assert.equal(r.migrated, true);
  assert.deepEqual(r.checks.map((c) => c.check), ['schema_version', 'record_count', 'ids', 'content', 'references', 'integrity_check']);
  assert.ok(r.checks.every((c) => c.ok));
  assert.ok(!exists(jsonlPath(root)));
  assert.equal(inventoryStatus(root).state, 'sqlite');
  assert.deepEqual(loadInventory(root).records, [...jsonlBefore].sort((a, b) => (a.id < b.id ? -1 : 1)));

  addInventoryRecord(root, { ...rec(1), terms: ['bloom filter'] });
  updateInventoryRecord(root, 'geo.shortest-path', { status: 'deprecated' });
  assert.ok(!exists(jsonlPath(root)), 'no JSONL is recreated after migration');
  assert.equal(findInventory(root, 'bloom').results[0].id, 'algo.item-0001');
  assert.equal(findInventory(root, 'dijkstra').results[0].status, 'deprecated');
  assert.equal(validateInventory(root).ok, true);
  // re-running is a no-op
  assert.equal(migrateInventory(root, { notified: true }).migrated, false);
});

test('SQLite search returns exactly what JSONL search returns (same bounded shape and ranking)', () => {
  const data = [FUZZY, ROUTE, ...Array.from({ length: 30 }, (_, i) => rec(i, { terms: ['graph', `topic${i}`] }))];
  const root = makeRepo({ records: data });
  const queries = ['levenshtein', 'graph search', 'dijkstra routing', 'topic7', 'fuzz', 'levenshteins', 'nothing-here'];
  const before = queries.map((q) => findInventory(root, q, { limit: 5 }));
  migrateInventory(root, { notified: true, force: true });
  const after = queries.map((q) => findInventory(root, q, { limit: 5 }));
  for (let i = 0; i < queries.length; i++) {
    assert.equal(after[i].source, 'sqlite');
    const strip = ({ state, source, ...rest }) => rest;
    assert.deepEqual(strip(after[i]), strip(before[i]), queries[i]);
  }
});

for (const faultAt of ['build', 'verify', 'before-rename']) {
  test(`failed migration (${faultAt}) leaves the JSONL byte-identical and SQLite absent`, () => {
    const root = makeRepo({ records: [FUZZY, ROUTE] });
    const before = fs.readFileSync(jsonlPath(root));
    assert.throws(() => migrateInventory(root, { notified: true, force: true, faultAt }));
    assert.deepEqual(fs.readFileSync(jsonlPath(root)), before);
    assert.ok(!exists(sqlitePath(root)));
    assert.notEqual(inventoryStatus(root).state, 'conflict');
    // safe to re-run
    assert.equal(migrateInventory(root, { notified: true, force: true }).migrated, true);
    assert.ok(!exists(path.join(root, 'tech', '.reuse-index.sqlite.tmp')));
  });
}

test('invalid JSONL is never migrated', () => {
  const root = makeRepo({ records: [FUZZY] });
  fs.appendFileSync(jsonlPath(root), '{not json\n');
  const before = fs.readFileSync(jsonlPath(root));
  assert.throws(() => migrateInventory(root, { notified: true, force: true }), (e) => e.code === 'INVALID_SOURCE');
  assert.deepEqual(fs.readFileSync(jsonlPath(root)), before);
  assert.ok(!exists(sqlitePath(root)));
});

test('interrupted after rename: both files → explicit conflict; recover finishes only on a verified match', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  assert.throws(() => migrateInventory(root, { notified: true, force: true, faultAt: 'before-delete' }), (e) => e.code === 'INTERRUPTED');
  const st = inventoryStatus(root);
  assert.equal(st.state, 'conflict');
  assert.match(st.message, /will not pick one/);
  assert.equal(findInventory(root, 'dijkstra').results.length, 0, 'no silent choice of a source');
  assert.throws(() => addInventoryRecord(root, rec(1)), (e) => e.code === 'CONFLICT');
  assert.equal(validateInventory(root).ok, false);
  assert.equal(cli(root, 'inventory', 'migrate', '--notified').code, 2);

  const r = recoverInventory(root);
  assert.equal(r.action, 'completed-migration');
  assert.equal(inventoryStatus(root).state, 'sqlite');
  assert.ok(!exists(jsonlPath(root)));
});

test('diverged JSONL and SQLite: recover refuses and shows the difference until the user picks', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  assert.throws(() => migrateInventory(root, { notified: true, force: true, faultAt: 'before-delete' }));
  fs.writeFileSync(jsonlPath(root), serializeJsonl([FUZZY]));
  assert.throws(() => recoverInventory(root), (e) => e.code === 'DIVERGED' && e.diff.added.some((x) => x.id === 'geo.shortest-path'));
  assert.ok(exists(jsonlPath(root)) && exists(sqlitePath(root)));
  assert.equal(recoverInventory(root, { keep: 'jsonl' }).action, 'kept-jsonl');
  assert.ok(exists(jsonlPath(root)) && !exists(sqlitePath(root)));
});

// ---- validation ---------------------------------------------------------------------------------

test('validation catches broken lines, duplicate ids, missing paths and unresolved capability/ADR links', () => {
  const root = makeRepo({ records: [FUZZY] });
  const bad = [
    '{"id": "broken"',
    JSON.stringify(FUZZY),
    JSON.stringify({ ...ROUTE, entry: 'src/missing.js#x', tests: ['test/missing.test.js'], capability: 'no-such-cap', adr: 'ADR-0999' }),
    JSON.stringify({ ...rec(1), notes: 'copied contract text' })
  ];
  fs.appendFileSync(jsonlPath(root), bad.join('\n') + '\n');
  const v = validateInventory(root);
  assert.equal(v.ok, false);
  const kinds = new Set(v.issues.map((i) => i.kind));
  for (const k of ['parse', 'duplicate', 'missing-entry', 'missing-test', 'unknown-capability', 'unknown-adr', 'invalid']) assert.ok(kinds.has(k), `expected ${k}`);
  assert.ok(v.issues.some((i) => /unknown field "notes"/.test(i.message)));

  fs.mkdirSync(path.join(root, 'quality'));
  fs.writeFileSync(path.join(root, 'quality', 'quality-gates.yaml'), 'gates:\n  - id: reuse-inventory\n    enforced: false\n');
  const report = audit(root);
  const gate = report.gates.find((g) => g.id === 'reuse-inventory');
  assert.equal(gate.status, 'failed');
  assert.equal(gate.failingCount, v.issues.length);
  assert.equal(report.ok, true, 'an advisory gate never fails the build');
});

test('writes refuse invalid records and broken references; records stay short pointers', () => {
  const root = makeRepo();
  assert.throws(() => addInventoryRecord(root, { ...FUZZY, entry: 'src/nope.js' }), (e) => e.code === 'BROKEN_REFERENCE');
  assert.throws(() => addInventoryRecord(root, { ...FUZZY, adr: 'ADR-0042' }), (e) => e.code === 'BROKEN_REFERENCE');
  assert.throws(() => addInventoryRecord(root, { ...FUZZY, purpose: 'x'.repeat(400) }), (e) => e.code === 'INVALID_RECORD');
  assert.throws(() => addInventoryRecord(root, { ...FUZZY, tests: [] }), (e) => e.code === 'INVALID_RECORD');
  assert.ok(validateRecord({ ...FUZZY, entry: '../outside.js' }).some((e) => /repository-relative/.test(e)));
  addInventoryRecord(root, FUZZY);
  assert.throws(() => addInventoryRecord(root, FUZZY), (e) => e.code === 'DUPLICATE_ID');
  assert.equal(validateInventory(root).ok, true);
});

// ---- module switch & AGENTS.md ------------------------------------------------------------------

test('disabled module: no inventory behavior, gate not evaluated, no AGENTS.md section', () => {
  const root = makeRepo({ modules: 'reuse_inventory: false', records: [FUZZY] });
  assert.equal(inventoryStatus(root).state, 'disabled');
  const f = findInventory(root, 'levenshtein');
  assert.equal(f.results.length, 0);
  assert.match(f.hint, /disabled/);
  assert.equal(validateInventory(root).evaluated, false);
  assert.throws(() => addInventoryRecord(root, ROUTE), (e) => e.code === 'DISABLED');
  fs.mkdirSync(path.join(root, 'quality'));
  fs.writeFileSync(path.join(root, 'quality', 'quality-gates.yaml'), 'gates:\n  - id: reuse-inventory\n    enforced: false\n');
  assert.equal(audit(root).gates.find((g) => g.id === 'reuse-inventory').status, 'not-evaluated');

  assert.ok(!composeAgentsMd('backend', { modules: { reuse_inventory: false } }).includes('## Reuse inventory'));
});

test('enabled by default: canonical AGENTS.md carries the search rules; pointer files do not', () => {
  for (const md of [composeAgentsMd('backend'), composeAgentsMd('backend', { modules: { reuse_inventory: true } })]) {
    assert.ok(md.includes(REUSE_INVENTORY_SECTION));
  }
  assert.match(REUSE_INVENTORY_SECTION, /Before building a large function/);
  assert.match(REUSE_INVENTORY_SECTION, /Search again when your implementation fails or becomes unexpectedly complex/);
  assert.match(REUSE_INVENTORY_SECTION, /open its entry point and tests/);
  for (const key of ['claude', 'cursor', 'windsurf', 'gemini', 'copilot']) assert.doesNotMatch(composeAgentPointer(key, './'), /inventory/i);
  const root = makeRepo({ records: [FUZZY] });
  fs.mkdirSync(path.join(root, 'quality'));
  fs.writeFileSync(path.join(root, 'quality', 'quality-gates.yaml'), 'gates:\n  - id: reuse-inventory\n    enforced: false\n');
  assert.equal(audit(root).gates.find((g) => g.id === 'reuse-inventory').status, 'passed');
});

// ---- Git review & merge -------------------------------------------------------------------------

test('readable diff: migration shows no record changes; SQLite edits show as +/~ lines', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'jsonl');
  migrateInventory(root, { notified: true, force: true });
  const across = diffInventory(root, { from: 'HEAD' });
  assert.equal(across.fromSource, 'jsonl');
  assert.equal(across.toSource, 'sqlite');
  assert.equal(formatDiff(across).length, 0);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'migrate');

  addInventoryRecord(root, { ...rec(9), terms: ['lru cache'] });
  updateInventoryRecord(root, 'text.fuzzy-match', { purpose: 'Rank strings by edit distance.' });
  const lines = formatDiff(diffInventory(root, { from: 'HEAD' }));
  assert.ok(lines.some((l) => l.startsWith('+ algo.item-0009')));
  assert.ok(lines.some((l) => l.startsWith('~ text.fuzzy-match.purpose')));
  const out = cli(root, 'inventory', 'diff');
  assert.equal(out.code, 0);
  assert.match(out.out, /\+ algo\.item-0009/);
  assert.doesNotMatch(out.out, /SQLite format 3/);
  assert.throws(() => diffInventory(root, { from: 'no-such-branch' }), (e) => e.code === 'UNKNOWN_REF');
});

test('parallel branches: record-level merge applies both sides; same-id edits are reported as conflicts', () => {
  const root = makeRepo({ records: [FUZZY, ROUTE] });
  git(root, 'init', '-q', '-b', 'main');
  migrateInventory(root, { notified: true, force: true });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'feature');
  addInventoryRecord(root, { ...rec(1), terms: ['bloom'] });
  updateInventoryRecord(root, 'geo.shortest-path', { purpose: 'A* and Dijkstra over weighted graphs.' });
  git(root, 'commit', '-q', '-am', 'feature');
  git(root, 'checkout', '-q', 'main');
  addInventoryRecord(root, { ...rec(2), terms: ['trie'] });
  updateInventoryRecord(root, 'geo.shortest-path', { purpose: 'Dijkstra with a binary heap.' });
  git(root, 'commit', '-q', '-am', 'main');

  const blocked = mergeInventory(root, 'feature');
  assert.equal(blocked.written, false);
  assert.deepEqual(blocked.conflicts.map((c) => c.id), ['geo.shortest-path']);
  assert.equal(cli(root, 'inventory', 'merge', 'feature').code, 2);

  const merged = mergeInventory(root, 'feature', { prefer: 'theirs' });
  assert.equal(merged.written, true);
  const ids = loadInventory(root).records.map((r) => r.id);
  assert.deepEqual(ids, ['algo.item-0001', 'algo.item-0002', 'geo.shortest-path', 'text.fuzzy-match']);
  assert.equal(loadInventory(root).records.find((r) => r.id === 'geo.shortest-path').purpose, 'A* and Dijkstra over weighted graphs.');
  assert.equal(validateInventory(root).ok, true);
});

test("this repository's canonical AGENTS.md carries the generated reuse-inventory section verbatim", () => {
  const agents = fs.readFileSync(path.resolve(here, '..', '..', '..', 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes(REUSE_INVENTORY_SECTION));
  for (const pointer of ['CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.cursor/rules/trellis.mdc', '.windsurf/rules/trellis.md']) {
    assert.doesNotMatch(fs.readFileSync(path.resolve(here, '..', '..', '..', pointer), 'utf8'), /inventory/i, pointer);
  }
});
