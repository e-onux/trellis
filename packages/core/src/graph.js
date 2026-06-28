// Pure evidence-graph shaping. Takes the loaded model (sources, decisions, capabilities as plain
// data - see evidence.js) and produces one normalized { nodes, edges } graph plus the references
// that don't resolve. NO Node APIs: browser-safe, deterministic, and the single shape that both
// the HTML viewer (graph-html.js) and the Obsidian export render.

export const NODE_TYPES = ['source', 'decision', 'capability'];
export const EDGE_KINDS = ['cites', 'governed-by'];

const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * Normalize a loaded evidence model into a graph.
 *
 * Edge direction is "is justified by": a capability points at the decisions that govern it and
 * the sources it cites; a decision points at the sources it cites. A source's own `supports`
 * list is folded into those same citation edges (and deduplicated), so declaring the link from
 * either side yields one edge. A reference whose target is not a node is collected in `dangling`.
 *
 * @param {{ sources?: object[], decisions?: object[], capabilities?: object[] }} model
 * @param {{ now?: string }} [opts]
 * @returns {{ nodes: object[], edges: object[], dangling: object[], stats: object, generatedAt: string }}
 */
export function buildEvidenceGraph(model = {}, { now } = {}) {
  const sources = arr(model.sources);
  const decisions = arr(model.decisions);
  const capabilities = arr(model.capabilities);

  const sourceIds = new Set(sources.map((s) => s.id));
  const decisionIds = new Set(decisions.map((d) => d.id));
  const capIds = new Set(capabilities.map((c) => c.id));

  const nodes = [];
  for (const s of sources) nodes.push({ id: s.id, type: 'source', title: s.title || s.id, url: s.url || null, claim: s.claim || null });
  for (const d of decisions) nodes.push({ id: d.id, type: 'decision', title: d.title || d.id, status: d.status || null, path: d.path || null });
  for (const c of capabilities) nodes.push({ id: c.id, type: 'capability', title: c.title || c.id, status: c.status || null, path: c.path || null });

  const edges = [];
  const dangling = [];
  const seen = new Set();
  const link = (from, to, kind) => {
    const key = `${from}|${to}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind });
  };
  const asCapId = (id) => (capIds.has(id) ? id : (capIds.has(id.replace(/^capability-/, '')) ? id.replace(/^capability-/, '') : null));

  for (const d of decisions) {
    for (const sid of arr(d.evidence)) {
      if (sourceIds.has(sid)) link(d.id, sid, 'cites');
      else dangling.push({ from: d.id, to: sid, kind: 'cites' });
    }
  }
  for (const c of capabilities) {
    for (const sid of arr(c.evidence)) {
      if (sourceIds.has(sid)) link(c.id, sid, 'cites');
      else dangling.push({ from: c.id, to: sid, kind: 'cites' });
    }
    for (const did of arr(c.decisions)) {
      if (decisionIds.has(did)) link(c.id, did, 'governed-by');
      else dangling.push({ from: c.id, to: did, kind: 'governed-by' });
    }
  }
  for (const s of sources) {
    for (const target of arr(s.supports)) {
      const id = String(target);
      if (decisionIds.has(id)) { link(id, s.id, 'cites'); continue; }
      const cap = asCapId(id);
      if (cap) link(cap, s.id, 'cites');
      else dangling.push({ from: s.id, to: id, kind: 'supports' });
    }
  }

  const stats = {
    sources: sources.length,
    decisions: decisions.length,
    capabilities: capabilities.length,
    nodes: nodes.length,
    edges: edges.length,
    dangling: dangling.length
  };
  return { nodes, edges, dangling, stats, generatedAt: now || new Date().toISOString() };
}
