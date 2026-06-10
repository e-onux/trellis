// Capability budget checker - the anti-bloat enforcement at the heart of Trellis.
// Measures what can be measured statically (files, LOC, declared dependencies) and reports the rest
// as declared-vs-budget so nothing silently passes.
import { fs, path, walkFiles, isCodeFile, countLoc } from './util.js';
import { readYaml } from './yaml.js';

// Artifacts that are governance/fixtures, not the capability's code footprint.
const NON_CODE_DIRS = ['examples', 'evidence'];
const NON_CODE_FILES = new Set(['contract.yaml', 'capability.md', 'changelog.md', 'CHANGELOG.md']);

/**
 * Resolve which files count toward a capability's footprint.
 * If the contract declares `implementation` (array of repo-relative paths/dirs), those are used.
 * Otherwise we count code files under the capability directory, excluding fixtures and pure docs.
 */
function resolveImplementationFiles(capabilityDir, contract, repoRoot) {
  if (Array.isArray(contract.implementation) && contract.implementation.length) {
    const files = [];
    for (const rel of contract.implementation) {
      const abs = path.resolve(repoRoot || capabilityDir, rel);
      if (!fs.existsSync(abs)) continue;
      if (fs.statSync(abs).isDirectory()) files.push(...walkFiles(abs).filter(isCodeFile));
      else files.push(abs);
    }
    return { files, mode: 'declared' };
  }
  const files = walkFiles(capabilityDir, { skipDirs: NON_CODE_DIRS })
    .filter((f) => !NON_CODE_FILES.has(path.basename(f)))
    .filter((f) => isCodeFile(f));
  return { files, mode: 'capability-dir' };
}

function countDeclaredDependencies(contract) {
  const d = contract.dependencies;
  if (!d) return 0;
  if (Array.isArray(d)) return d.length;
  return (d.internal?.length || 0) + (d.external?.length || 0);
}

/**
 * @returns {{ id, ok, mode, checks: Array<{budget,limit,measured,ok,measurable}>, violations: string[] }}
 */
export function budgetCheck(capabilityDir, { repoRoot } = {}) {
  const contractPath = path.join(capabilityDir, 'contract.yaml');
  if (!fs.existsSync(contractPath)) {
    return { id: path.basename(capabilityDir), ok: false, mode: 'none', checks: [], violations: ['no contract.yaml'] };
  }
  const contract = readYaml(contractPath);
  const budgets = contract.budgets || {};
  const { files, mode } = resolveImplementationFiles(capabilityDir, contract, repoRoot);
  const loc = files.reduce((sum, f) => sum + countLoc(f), 0);
  const directDeps = countDeclaredDependencies(contract);

  // measured = value we can compute; null means "declared only / not auto-measured".
  const measured = {
    max_files: files.length,
    max_lines_of_code: loc,
    max_direct_dependencies: directDeps,
    max_public_operations: null,
    max_database_tables: null,
    max_external_services: contract.dependencies?.external?.length ?? null,
    max_cyclomatic_complexity: null,
    max_nesting_depth: null,
    max_change_reasons: null
  };

  const checks = [];
  const violations = [];
  for (const [budget, limit] of Object.entries(budgets)) {
    const m = measured[budget];
    const measurable = m !== null && m !== undefined;
    const ok = !measurable || m <= limit;
    checks.push({ budget, limit, measured: measurable ? m : null, ok, measurable });
    if (measurable && !ok) violations.push(`${budget}: ${m} > ${limit}`);
  }

  return { id: contract.id || path.basename(capabilityDir), ok: violations.length === 0, mode, checks, violations };
}
