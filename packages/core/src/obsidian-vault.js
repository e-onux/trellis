// Pure Obsidian-vault renderer for the evidence graph. Takes the graph produced by
// buildEvidenceGraph (graph.js) and emits a flat list of { path, content } notes: one Markdown
// note per node (under sources/ | decisions/ | capabilities/) plus a `_evidence-graph.md`
// map-of-content. NO Node APIs: browser-safe, deterministic, and stable across runs given the
// same graph. Edges read "is justified by", so each note links its outgoing citations / governance
// and back-links the nodes that reference it - the provenance reads from both ends.

const FOLDER = { source: 'sources', decision: 'decisions', capability: 'capabilities' };
const KIND_HEADING = { cites: 'Cites', 'governed-by': 'Governed by' };

const byTypeThenId = (a, b) =>
  a.type === b.type ? cmp(a.id, b.id) : cmp(FOLDER[a.type] || a.type, FOLDER[b.type] || b.type);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Escape a YAML scalar conservatively: quote it and backslash-escape quotes/backslashes. */
function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** A wikilink to a node id, aliased to the target node's title (falling back to the raw id). */
function wikilink(id, titleOf) {
  return `[[${id}|${titleOf(id) || id}]]`;
}

/** Build the YAML frontmatter block for a node note. */
function frontmatter(node) {
  const lines = [`type: ${node.type}`, `id: ${yamlString(node.id)}`, `title: ${yamlString(node.title)}`];
  if (node.status) lines.push(`status: ${yamlString(node.status)}`);
  if (node.type === 'source' && node.url) lines.push(`url: ${yamlString(node.url)}`);
  lines.push(`tags: [trellis/${node.type}]`);
  return `---\n${lines.join('\n')}\n---`;
}

/** Render one node note (frontmatter + body + outgoing groups + referenced-by). */
function renderNode(node, outgoing, incoming, titleOf) {
  const sections = [frontmatter(node), `# ${node.title}`];

  if (node.type === 'source') {
    if (node.claim) sections.push(`> ${node.claim}`);
    if (node.url) sections.push(`[${node.title}](${node.url})`);
  }

  for (const kind of ['cites', 'governed-by']) {
    const targets = outgoing.filter((e) => e.kind === kind).map((e) => e.to);
    if (!targets.length) continue;
    const links = targets.map((to) => `- ${wikilink(to, titleOf)}`);
    sections.push(`## ${KIND_HEADING[kind]}\n${links.join('\n')}`);
  }

  if (incoming.length) {
    const links = incoming.map((e) => `- ${wikilink(e.from, titleOf)}`);
    sections.push(`## Referenced by\n${links.join('\n')}`);
  }

  return sections.join('\n\n') + '\n';
}

/** Render the `_evidence-graph.md` map-of-content. */
function renderMoc(nodes, dangling, stats, titleOf) {
  const summary =
    `${stats.sources} sources, ${stats.decisions} decisions, ${stats.capabilities} capabilities ` +
    `(${stats.nodes} nodes, ${stats.edges} edges, ${stats.dangling} dangling).`;
  const sections = [
    '---\ntitle: Evidence graph\ntags: [trellis/moc]\n---',
    '# Evidence graph',
    summary
  ];

  for (const type of ['source', 'decision', 'capability']) {
    const group = nodes.filter((n) => n.type === type);
    if (!group.length) continue;
    const heading = FOLDER[type][0].toUpperCase() + FOLDER[type].slice(1); // sources -> Sources
    const links = group.map((n) => `- ${wikilink(n.id, titleOf)}`);
    sections.push(`## ${heading}\n${links.join('\n')}`);
  }

  if (dangling.length) {
    const items = dangling.map((d) => `- ${d.from} ${d.kind} ${d.to} (unresolved)`);
    sections.push(`## Dangling references\n${items.join('\n')}`);
  }

  return sections.join('\n\n') + '\n';
}

/**
 * Render an evidence graph as an Obsidian vault.
 *
 * @param {{ nodes: object[], edges: object[], dangling: object[], stats: object }} graph
 * @param {{ now?: string }} [opts] reserved for future timestamping; output is `now`-stable.
 * @returns {Array<{ path: string, content: string }>} vault-relative notes, deterministically sorted.
 */
export function renderObsidianVault(graph = {}, { now } = {}) {
  void now;
  const nodes = [...(graph.nodes || [])].sort(byTypeThenId);
  const edges = graph.edges || [];
  const dangling = graph.dangling || [];
  const stats = graph.stats || {};

  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  const titleOf = (id) => titles.get(id);

  const files = [];
  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.from === node.id);
    const incoming = edges.filter((e) => e.to === node.id);
    files.push({
      path: `${FOLDER[node.type] || node.type}/${node.id}.md`,
      content: renderNode(node, outgoing, incoming, titleOf)
    });
  }
  files.push({ path: '_evidence-graph.md', content: renderMoc(nodes, dangling, stats, titleOf) });

  files.sort((a, b) => cmp(a.path, b.path));
  return files;
}
