// Evidence-graph data layer. Loads the governed artifacts that make up a repository's evidence
// graph - sources, decisions (ADRs) and capabilities - so that both the audit (reference
// integrity) and the visualization (graph view + Obsidian export) read them through one place.
// Node-only: this module reads the repository from disk. The pure graph-shaping step lives in
// buildEvidenceGraph (see graph.js) and takes the loaded model as plain data.
import { fs, path, walkFiles } from './util.js';
import { readYaml, extractYamlBlock } from './yaml.js';

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
