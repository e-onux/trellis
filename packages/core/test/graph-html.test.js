// Evidence-graph HTML viewer tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGraphHtml } from '../src/graph-html.js';

const sample = {
  nodes: [
    { id: 'source-1', type: 'source', title: 'A source', url: 'https://example.com', claim: 'A claim' },
    { id: 'ADR-1', type: 'decision', title: 'A decision', status: 'accepted' },
    { id: 'cap-a', type: 'capability', title: 'A capability', status: 'active' }
  ],
  edges: [
    { from: 'ADR-1', to: 'source-1', kind: 'cites' },
    { from: 'cap-a', to: 'ADR-1', kind: 'governed-by' }
  ],
  dangling: [],
  stats: { sources: 1, decisions: 1, capabilities: 1, nodes: 3, edges: 2, dangling: 0 }
};

test('renders one self-contained document with the graph embedded as JSON', () => {
  const html = renderGraphHtml(sample, { now: '2026-06-14T00:00:00Z' });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('var DATA='));
  assert.ok(!/src=|href="http/.test(html), 'no external resources are referenced');
  const data = JSON.parse(html.split('var DATA=')[1].split(';\n(function')[0]);
  assert.equal(data.nodes.length, 3);
  assert.equal(data.edges.length, 2);
});

test('the embedded client script is syntactically valid', () => {
  const html = renderGraphHtml(sample);
  const client = '(function' + html.split(';\n(function')[1].split('</script>')[0];
  assert.doesNotThrow(() => new Function(client));
});

test('escapes characters that would break the script context', () => {
  const html = renderGraphHtml({ nodes: [{ id: 'x', type: 'source', title: '</script><b>x' }], edges: [] });
  assert.ok(!html.includes('</script><b>x'), 'a literal </script> must not survive in the data');
  assert.ok(html.includes('\\u003c'));
});

test('an empty graph still produces a valid document', () => {
  const html = renderGraphHtml({ nodes: [], edges: [] });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('var DATA='));
});
