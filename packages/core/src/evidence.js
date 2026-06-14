// Evidence-graph data layer. Loads the governed artifacts that make up a repository's evidence
// graph - sources, decisions (ADRs) and capabilities - so that both the audit (reference
// integrity) and the visualization (graph view + Obsidian export) read them through one place.
// Node-only: this module reads the repository from disk. The pure graph-shaping step lives in
// buildEvidenceGraph (see graph.js) and takes the loaded model as plain data.
import { fs, path, walkFiles } from './util.js';
import { readYaml, extractYamlBlock } from './yaml.js';
import { buildEvidenceGraph } from './graph.js';

const DEFAULT_CAPS_DIR = 'capabilities';

export function loadConfig(repoRoot) {
  const p = path.join(repoRoot, '.trellis.yaml');
  return fs.existsSync(p) ? readYaml(p) : {};
}

/** Capability directories (under capsDir) that carry a contract.yaml. */
export function findCapabilityDirs(repoRoot, capsDir = DEFAULT_CAPS_DIR) {
  const base = path.join(repoRoot, capsDir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(base, e.name))
    .filter((d) => fs.existsSync(path.join(d, 'contract.yaml')));
}

/** All ADRs under tech/decisions/, with their parsed YAML front matter. */
export function loadAdrs(repoRoot) {
  const ids = new Set();
  const adrs = [];
  const dir = path.join(repoRoot, 'tech', 'decisions');
  for (const file of walkFiles(dir)) {
    if (!file.endsWith('.md')) continue;
    const doc = extractYamlBlock(fs.readFileSync(file, 'utf8'));
    if (doc?.id) { ids.add(doc.id); adrs.push({ id: doc.id, doc, file }); }
  }
  return { ids, adrs };
}

/** The bibliography source records. */
export function loadSources(repoRoot) {
  const bib = path.join(repoRoot, 'sources', 'bibliography.yaml');
  return fs.existsSync(bib) ? (readYaml(bib)?.sources || []) : [];
}

function capabilitySummary(dir, repoRoot) {
  const contract = readYaml(path.join(dir, 'contract.yaml'));
  return {
    id: contract.id || path.basename(dir),
    title: contract.title || contract.id || path.basename(dir),
    status: contract.status || null,
    evidence: Array.isArray(contract.evidence) ? contract.evidence : [],
    decisions: Array.isArray(contract.decisions) ? contract.decisions : [],
    path: path.relative(repoRoot, dir)
  };
}

/**
 * Read the repository's evidence artifacts into plain { sources, decisions, capabilities } data,
 * ready for buildEvidenceGraph. This is the Node-side counterpart to the pure shaping in graph.js.
 */
export function loadEvidenceModel(repoRoot) {
  repoRoot = path.resolve(repoRoot || '.');
  const cfg = loadConfig(repoRoot);
  const capsDir = cfg.paths?.capabilities || DEFAULT_CAPS_DIR;
  const capabilities = findCapabilityDirs(repoRoot, capsDir).map((d) => capabilitySummary(d, repoRoot));
  const decisions = loadAdrs(repoRoot).adrs.map(({ id, doc, file }) => ({
    id,
    title: doc.title || id,
    status: doc.status || null,
    evidence: (doc.evidence || []).map((e) => (e && e.id ? e.id : e)).filter(Boolean),
    path: path.relative(repoRoot, file)
  }));
  const sources = loadSources(repoRoot).map((s) => ({
    id: s.id,
    title: s.title || s.id,
    type: s.type || null,
    url: s.url || null,
    claim: s.relevance?.claim || null,
    supports: Array.isArray(s.supports) ? s.supports.map(String) : []
  }));
  return { sources, decisions, capabilities };
}

/** Load the repository and shape it into a { nodes, edges, dangling } graph in one call. */
export function loadEvidenceGraph(repoRoot, opts) {
  return buildEvidenceGraph(loadEvidenceModel(repoRoot), opts);
}
