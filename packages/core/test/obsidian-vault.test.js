// Obsidian-vault renderer tests. Run: node --test packages/core/test/obsidian-vault.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderObsidianVault } from '../src/obsidian-vault.js';

// A small but complete graph: one source, a decision citing it, and a capability that is governed
// by the decision and also cites the source - the Source -> Decision -> Capability provenance.
function smallGraph(extra = {}) {
  return {
    nodes: [
      { id: 'source-a', type: 'source', title: 'A study', url: 'https://example.com/a', claim: 'Small modules win.' },
      { id: 'ADR-0001', type: 'decision', title: 'Record decisions', status: 'accepted' },
      { id: 'cap-x', type: 'capability', title: 'Do the thing', status: 'active' }
    ],
    edges: [
      { from: 'ADR-0001', to: 'source-a', kind: 'cites' },
      { from: 'cap-x', to: 'ADR-0001', kind: 'governed-by' },
      { from: 'cap-x', to: 'source-a', kind: 'cites' }
    ],
    dangling: [],
    stats: { sources: 1, decisions: 1, capabilities: 1, nodes: 3, edges: 3, dangling: 0 },
    generatedAt: '2026-06-14T00:00:00.000Z',
    ...extra
  };
}

const at = (files, path) => files.find((f) => f.path === path);

test('renders one note per node plus the map-of-content index', () => {
  const files = renderObsidianVault(smallGraph());
  const paths = files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    '_evidence-graph.md',
    'capabilities/cap-x.md',
    'decisions/ADR-0001.md',
    'sources/source-a.md'
  ]);
});

test('a node note carries frontmatter, a heading and the right tag', () => {
  const files = renderObsidianVault(smallGraph());
  const src = at(files, 'sources/source-a.md').content;
  assert.match(src, /^---\n/);
  assert.match(src, /type: source/);
  assert.match(src, /id: "source-a"/);
  assert.match(src, /tags: \[trellis\/source\]/);
  assert.match(src, /^# A study$/m);
});

test('a source note renders its claim as a blockquote and its url as a link', () => {
  const src = at(renderObsidianVault(smallGraph()), 'sources/source-a.md').content;
  assert.match(src, /url: "https:\/\/example\.com\/a"/);
  assert.match(src, /^> Small modules win\.$/m);
  assert.match(src, /\[A study\]\(https:\/\/example\.com\/a\)/);
});

test('a capability note links governance under "Governed by" and citations under "Cites"', () => {
  const cap = at(renderObsidianVault(smallGraph()), 'capabilities/cap-x.md').content;
  assert.match(cap, /## Governed by\n- \[\[ADR-0001\|Record decisions\]\]/);
  assert.match(cap, /## Cites\n- \[\[source-a\|A study\]\]/);
});

test('the source note back-links the decision and capability that reference it', () => {
  const src = at(renderObsidianVault(smallGraph()), 'sources/source-a.md').content;
  const ref = src.slice(src.indexOf('## Referenced by'));
  assert.match(ref, /\[\[ADR-0001\|Record decisions\]\]/);
  assert.match(ref, /\[\[cap-x\|Do the thing\]\]/);
});

test('a note with no incoming edges omits the empty "Referenced by" section', () => {
  // cap-x is a leaf in the "is justified by" direction - nothing points at it.
  const cap = at(renderObsidianVault(smallGraph()), 'capabilities/cap-x.md').content;
  assert.doesNotMatch(cap, /## Referenced by/);
});

test('the map-of-content lists every node and reports the right counts', () => {
  const moc = at(renderObsidianVault(smallGraph()), '_evidence-graph.md').content;
  assert.match(moc, /title: Evidence graph/);
  assert.match(moc, /tags: \[trellis\/moc\]/);
  assert.match(moc, /1 sources, 1 decisions, 1 capabilities \(3 nodes, 3 edges, 0 dangling\)\./);
  assert.match(moc, /## Sources\n- \[\[source-a\|A study\]\]/);
  assert.match(moc, /## Decisions\n- \[\[ADR-0001\|Record decisions\]\]/);
  assert.match(moc, /## Capabilities\n- \[\[cap-x\|Do the thing\]\]/);
});

test('calling twice with the same { now } returns deep-equal output (determinism)', () => {
  const a = renderObsidianVault(smallGraph(), { now: '2026-06-14T00:00:00.000Z' });
  const b = renderObsidianVault(smallGraph(), { now: '2026-06-14T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('the returned array is sorted by path regardless of node order', () => {
  const g = smallGraph();
  g.nodes.reverse();
  const paths = renderObsidianVault(g).map((f) => f.path);
  assert.deepEqual(paths, [...paths].sort());
});

test('dangling references show in the MOC and are NOT rendered as wikilinks', () => {
  const g = smallGraph({
    dangling: [{ from: 'cap-x', to: 'source-missing', kind: 'cites' }],
    stats: { sources: 1, decisions: 1, capabilities: 1, nodes: 3, edges: 3, dangling: 1 }
  });
  const moc = at(renderObsidianVault(g), '_evidence-graph.md').content;
  assert.match(moc, /## Dangling references/);
  assert.match(moc, /cap-x cites source-missing/);
  // The dangling target must not resolve as a wikilink.
  assert.doesNotMatch(moc, /\[\[source-missing/);
});

test('an empty graph still yields a well-formed map-of-content and nothing else', () => {
  const files = renderObsidianVault({
    nodes: [], edges: [], dangling: [],
    stats: { sources: 0, decisions: 0, capabilities: 0, nodes: 0, edges: 0, dangling: 0 }
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].path, '_evidence-graph.md');
  assert.match(files[0].content, /0 sources, 0 decisions, 0 capabilities/);
});
