// Measures the JSONL → SQLite threshold for the reuse inventory (ADR-0008). Not a test; run by hand:
//   node packages/core/bench/inventory-threshold.js
// Generates realistic synthetic records, then for each size reports file bytes, the token cost of
// an agent reading the whole JSONL (≈ bytes / 4), `find` latency on JSONL vs SQLite, and the
// (constant) size of a bounded `find` answer. No network, no model calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { serializeJsonl, searchRecords } from '../src/inventory.js';
import { findInventory } from '../src/inventory-store.js';
import { migrateInventory } from '../src/inventory-migrate.js';

const DOMAINS = ['text', 'geo', 'billing', 'auth', 'graph', 'image', 'date', 'search', 'cache', 'parse', 'stats', 'crypto'];
const VERBS = ['fuzzy-match', 'shortest-path', 'prorate', 'rate-limit', 'dedupe', 'tokenize', 'rrule-expand', 'resample', 'diff', 'merge', 'score', 'cluster'];
const WORDS = ['levenshtein', 'dijkstra', 'haversine', 'token-bucket', 'minhash', 'bm25', 'kmeans', 'lru', 'rfc5545', 'iso8601', 'myers', 'crdt', 'bloom', 'simhash', 'trie', 'quantile'];

function record(i) {
  const d = DOMAINS[i % DOMAINS.length];
  const v = VERBS[(i * 7) % VERBS.length];
  const terms = Array.from({ length: 6 }, (_, k) => WORDS[(i + k * 5) % WORDS.length]);
  return {
    id: `${d}.${v}-${i}`,
    purpose: `Reusable ${v.replace('-', ' ')} for ${d} data with edge cases handled and verified by tests.`,
    terms,
    entry: `src/${d}/${v}-${i}.js#${v.replace(/-(.)/g, (_, c) => c.toUpperCase())}`,
    tests: [`test/${d}/${v}-${i}.test.js`],
    status: i % 17 === 0 ? 'deprecated' : 'active',
    ...(i % 3 === 0 ? { capability: `${d}-${v}` } : {})
  };
}

const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function time(fn, runs = 15) {
  const t = [];
  for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
  return median(t);
}

const rows = [];
for (const n of [50, 100, 200, 400, 800, 1600, 3200]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-bench-'));
  fs.mkdirSync(path.join(root, 'tech'));
  fs.writeFileSync(path.join(root, '.trellis.yaml'), 'modules:\n  reuse_inventory: true\n');
  const recs = Array.from({ length: n }, (_, i) => record(i));
  const text = serializeJsonl(recs);
  fs.writeFileSync(path.join(root, 'tech', 'reuse-index.jsonl'), text);
  const q = 'levenshtein fuzzy match';
  const jsonlMs = time(() => findInventory(root, q));
  const answerBytes = Buffer.byteLength(JSON.stringify(searchRecords(recs, q)));
  migrateInventory(root, { notified: true, force: true });
  const sqliteMs = time(() => findInventory(root, q));
  const sqliteBytes = fs.statSync(path.join(root, 'tech', 'reuse-index.sqlite')).size;
  rows.push({
    records: n,
    jsonl_kib: +(text.length / 1024).toFixed(1),
    whole_file_tokens: Math.round(text.length / 4),
    jsonl_find_ms: +jsonlMs.toFixed(2),
    sqlite_find_ms: +sqliteMs.toFixed(2),
    sqlite_kib: +(sqliteBytes / 1024).toFixed(1),
    find_answer_tokens: Math.round(answerBytes / 4)
  });
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`node ${process.version} ${process.platform}-${process.arch}`);
console.table(rows);
