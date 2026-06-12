// Capability budget checker - the anti-bloat enforcement at the heart of Trellis.
// Measures what can be measured statically (files, LOC, real imports) and reports the rest
// as declared-vs-budget so nothing silently passes.
import { fs, path, walkFiles, isCodeFile, countLoc } from './util.js';
import { readYaml } from './yaml.js';

// Artifacts that are governance/fixtures, not the capability's code footprint.
const NON_CODE_DIRS = ['examples', 'evidence'];
const NON_CODE_FILES = new Set(['contract.yaml', 'capability.md', 'changelog.md', 'CHANGELOG.md']);

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'test', 'sqlite'
]);

const JS_EXT = /\.(js|mjs|cjs|jsx|ts|tsx)$/;
const PY_EXT = /\.py$/;

/** Reduce an import specifier to its package name ("@scope/pkg/sub" -> "@scope/pkg"). */
function packageOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Scan implementation files for real external imports.
 * JS/TS: import/export-from/dynamic import/require specifiers. Relative and node: specifiers
 * are internal; everything else counts as an external package.
 * Python: top-level `import x` / `from x import` (relative `from .x` is internal; standard
 * library modules cannot be distinguished without an environment, so they count - keep
 * Python budgets accordingly or declare dependencies explicitly).
 * @returns {{ external: string[], scanned: number }}
 */
export function scanImports(files) {
  const external = new Set();
  let scanned = 0;
  for (const file of files) {
    let src;
    if (JS_EXT.test(file)) {
      try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
      scanned++;
      const re = /(?:\bimport\s+[^'"]*?from\s*|\bexport\s+[^'"]*?from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
      for (const m of src.matchAll(re)) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#')) continue;
        const bare = spec.startsWith('node:') ? spec.slice(5) : spec;
        if (NODE_BUILTINS.has(packageOf(bare))) continue;
        external.add(packageOf(spec));
      }
    } else if (PY_EXT.test(file)) {
      try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
      scanned++;
      for (const m of src.matchAll(/^\s*(?:import\s+([A-Za-z_][\w.]*)|from\s+([A-Za-z_][\w.]*)\s+import\b)/gm)) {
        const mod = (m[1] || m[2]).split('.')[0];
        external.add(mod);
      }
    }
  }
  return { external: [...external].sort(), scanned };
}

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
 * @returns {{ id, ok, mode, depsSource, externalImports, checks: Array<{budget,limit,measured,ok,measurable}>, violations: string[] }}
 */
export function budgetCheck(capabilityDir, { repoRoot } = {}) {
  const contractPath = path.join(capabilityDir, 'contract.yaml');
  if (!fs.existsSync(contractPath)) {
    return { id: path.basename(capabilityDir), ok: false, mode: 'none', depsSource: 'none', externalImports: [], checks: [], violations: ['no contract.yaml'] };
  }
  const contract = readYaml(contractPath);
  const budgets = contract.budgets || {};
  const { files, mode } = resolveImplementationFiles(capabilityDir, contract, repoRoot);
  const loc = files.reduce((sum, f) => sum + countLoc(f), 0);

  // Dependencies: prefer what the code actually imports over what the contract declares.
  const imports = scanImports(files);
  const depsSource = imports.scanned > 0 ? 'imports' : 'declared';
  const directDeps = depsSource === 'imports' ? imports.external.length : countDeclaredDependencies(contract);

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

  return {
    id: contract.id || path.basename(capabilityDir),
    ok: violations.length === 0,
    mode,
    depsSource,
    externalImports: imports.external,
    checks,
    violations
  };
}
