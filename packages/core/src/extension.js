// Extension completeness checker. Reads extension-registry.yaml files and verifies that every
// `required_updates` path actually exists - turning EXTENSIONS.md into a verifiable contract.
import { fs, path, walkFiles } from './util.js';
import { readYaml } from './yaml.js';

/** Find all extension-registry.yaml files under repoRoot (directory-local contracts). */
export function findRegistries(repoRoot) {
  return walkFiles(repoRoot, { skipDirs: ['node_modules', '.git', 'standard'] })
    .filter((f) => path.basename(f) === 'extension-registry.yaml');
}

function evalRequired(update) {
  // `required` defaults to true unless explicitly false. `required_if` is reported but not auto-evaluated.
  if (update.required === false) return false;
  if (update.required_if) return 'conditional';
  return true;
}

/**
 * Validate one extension contract object.
 * @returns {{ id, ok, missing: string[], conditional: string[] }}
 */
function validateContractEntry(entry, repoRoot) {
  const missing = [];
  const conditional = [];
  const updates = entry.registration?.required_updates || [];
  for (const u of updates) {
    const req = evalRequired(u);
    const abs = path.resolve(repoRoot, u.path);
    const exists = fs.existsSync(abs);
    if (!exists) {
      if (req === true) missing.push(`${u.path} (${u.operation})`);
      else if (req === 'conditional') conditional.push(`${u.path} (if ${u.required_if})`);
    }
  }
  return { id: entry.id, ok: missing.length === 0, missing, conditional };
}

/**
 * @param {string} repoRoot
 * @param {string} [only] optional extension id to check
 * @returns {{ ok, results: Array, registries: string[] }}
 */
export function validateExtensions(repoRoot, only) {
  const registries = findRegistries(repoRoot);
  const results = [];
  for (const reg of registries) {
    let doc;
    try {
      doc = readYaml(reg);
    } catch (e) {
      results.push({ id: path.relative(repoRoot, reg), ok: false, missing: [`unparseable: ${e.message}`], conditional: [] });
      continue;
    }
    const contracts = doc?.contracts || (doc?.id ? [doc] : []);
    for (const entry of contracts) {
      if (only && entry.id !== only) continue;
      results.push(validateContractEntry(entry, repoRoot));
    }
  }
  return { ok: results.every((r) => r.ok), results, registries: registries.map((r) => path.relative(repoRoot, r)) };
}
