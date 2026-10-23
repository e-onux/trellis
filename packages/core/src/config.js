// Single source of truth for locating a repository's Trellis config and its governed areas.
// The layout is config-driven: `root` nests every governed area under one directory (current
// default: `trellis/`), while `paths` names each area within that root. A repo with no `root`
// uses the legacy top-level layout, so repositories written before the consolidation keep working
// unchanged. Node-only (reads the filesystem); the browser build never imports this module.
import { fs, path } from './util.js';
import { readYaml } from './yaml.js';

// Area -> default directory name (relative to `root`).
export const DEFAULT_PATHS = {
  governance: 'governance', product: 'product', tech: 'tech', sources: 'sources',
  extensions: 'extensions', capabilities: 'capabilities', quality: 'quality', lifecycle: 'lifecycle'
};

// Config file locations, newest first. `trellis/trellis.yaml` is the consolidated layout;
// `.trellis.yaml` at the repo root is the legacy location (still honored).
export const CONFIG_LOCATIONS = ['trellis/trellis.yaml', '.trellis.yaml'];

/** Load the Trellis config object for a repo (empty object when none is present). */
export function loadConfig(repoRoot) {
  for (const rel of CONFIG_LOCATIONS) {
    const file = path.join(repoRoot, rel);
    if (fs.existsSync(file)) return readYaml(file) || {};
  }
  return {};
}

/** Absolute path to the governed root (`<repoRoot>/<config.root>`; repoRoot itself when unset). */
export function governedRoot(repoRoot, config) {
  return path.join(repoRoot, config?.root || '');
}

/**
 * Absolute path to a governed area, honoring `config.root` + `config.paths`, with optional
 * sub-path segments. `areaDir(root, cfg, 'tech', 'decisions')` -> `<root>/<cfg.root>/<tech>/decisions`.
 */
export function areaDir(repoRoot, config, area, ...sub) {
  const name = config?.paths?.[area] || DEFAULT_PATHS[area] || area;
  return path.join(repoRoot, config?.root || '', name, ...sub);
}

/**
 * Absolute path to the out-of-band model-provenance log. Consolidated layout:
 * `<root>/provenance.jsonl`; legacy (no `root`): `.trellis/provenance.jsonl`.
 */
export function provenancePath(repoRoot, config) {
  const root = config?.root;
  return root
    ? path.join(repoRoot, root, 'provenance.jsonl')
    : path.join(repoRoot, '.trellis', 'provenance.jsonl');
}
