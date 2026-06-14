// Evidence-graph model tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvidenceGraph, loadEvidenceGraph } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

test('resolvable references become typed nodes and one deduplicated edge', () => {
  const g = buildEvidenceGraph({
    sources: [{ id: 'source-1', title: 'A source' }],
    decisions: [{ id: 'ADR-1', evidence: ['source-1'] }],
    capabilities: []
  });
  assert.equal(g.nodes.length, 2);
  assert.equal(g.edges.length, 1);
  assert.deepEqual(g.edges[0], { from: 'ADR-1', to: 'source-1', kind: 'cites' });
  assert.equal(g.dangling.length, 0);
  assert.equal(g.nodes.find((n) => n.id === 'source-1').type, 'source');
});

test('a citation to a missing source is reported as dangling, not linked', () => {
  const g = buildEvidenceGraph({
    sources: [],
    decisions: [{ id: 'ADR-1', evidence: ['source-x'] }],
    capabilities: []
  });
  assert.equal(g.edges.length, 0);
  assert.equal(g.dangling.length, 1);
  assert.equal(g.dangling[0].to, 'source-x');
});

test('a source.supports link folds into the same citation edge and deduplicates', () => {
  const g = buildEvidenceGraph({
    sources: [{ id: 'source-1', supports: ['ADR-1'] }],
    decisions: [{ id: 'ADR-1', evidence: ['source-1'] }],
    capabilities: []
  });
  assert.equal(g.edges.length, 1, 'declaring the link from both ends yields one edge');
  assert.deepEqual(g.edges[0], { from: 'ADR-1', to: 'source-1', kind: 'cites' });
});

test('a capability is linked to the decision that governs it', () => {
  const g = buildEvidenceGraph({
    sources: [],
    decisions: [{ id: 'ADR-1' }],
    capabilities: [{ id: 'cap-a', decisions: ['ADR-1'] }]
  });
  assert.deepEqual(g.edges, [{ from: 'cap-a', to: 'ADR-1', kind: 'governed-by' }]);
});

test('loadEvidenceGraph reads this repository and links its real evidence graph', () => {
  const g = loadEvidenceGraph(repoRoot);
  const ids = new Set(g.nodes.map((n) => n.id));
  assert.ok(ids.has('repo-audit'), 'discovers the repo-audit capability');
  assert.ok(ids.has('ADR-0004'), 'discovers ADR-0004');
  assert.ok(ids.has('build-evidence-graph'));
  assert.ok(g.edges.length > 0, 'the self-hosted repo has a connected evidence graph');
  assert.equal(g.dangling.length, 0, 'the repo has no dangling references');
  assert.ok(g.edges.some((e) => e.from === 'build-evidence-graph' && e.to === 'ADR-0004'),
    'build-evidence-graph is governed by ADR-0004');
});
