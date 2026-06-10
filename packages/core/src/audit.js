// Whole-repository audit. Discovers capabilities, validates contracts, runs budget checks,
// checks ADR/source review freshness, runs extension completeness, and maps results to quality gates.
import { fs, path, walkFiles } from './util.js';
import { readYaml, extractYamlBlock } from './yaml.js';
import { validateContract } from './contract.js';
import { budgetCheck } from './budgets.js';
import { validateExtensions } from './extension.js';

function loadConfig(repoRoot) {
  const p = path.join(repoRoot, '.trellis.yaml');
  return fs.existsSync(p) ? readYaml(p) : {};
}

function findCapabilityDirs(repoRoot, capsDir) {
  const base = path.join(repoRoot, capsDir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(base, e.name))
    .filter((d) => fs.existsSync(path.join(d, 'contract.yaml')));
}

function checkReviewFreshness(repoRoot, today = new Date()) {
  const overdue = [];
  const decisionsDir = path.join(repoRoot, 'tech', 'decisions');
  for (const file of walkFiles(decisionsDir)) {
    if (!file.endsWith('.md')) continue;
    const doc = extractYamlBlock(fs.readFileSync(file, 'utf8'));
    const next = doc?.review?.next_review;
    if (next && new Date(next) < today) overdue.push({ kind: 'ADR', id: doc.id || path.basename(file), next_review: next });
  }
  const bib = path.join(repoRoot, 'sources', 'bibliography.yaml');
  if (fs.existsSync(bib)) {
    const sources = readYaml(bib)?.sources || [];
    for (const s of sources) {
      if (s.next_review && new Date(s.next_review) < today) overdue.push({ kind: 'source', id: s.id, next_review: s.next_review });
    }
  }
  return overdue;
}

/**
 * @returns {{ summary, capabilities, reviews, extensions, gates, ok }}
 */
export function audit(repoRoot, { now } = {}) {
  repoRoot = path.resolve(repoRoot || process.cwd());
  const config = loadConfig(repoRoot);
  const capsDir = config.paths?.capabilities || 'capabilities';

  const capabilities = [];
  for (const dir of findCapabilityDirs(repoRoot, capsDir)) {
    const contract = readYaml(path.join(dir, 'contract.yaml'));
    const validation = validateContract(contract);
    const budget = budgetCheck(dir, { repoRoot });
    capabilities.push({
      id: contract.id || path.basename(dir),
      path: path.relative(repoRoot, dir),
      status: contract.status,
      contractOk: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      budgetOk: budget.ok,
      budgetViolations: budget.violations,
      budgetChecks: budget.checks
    });
  }

  const reviews = checkReviewFreshness(repoRoot, now ? new Date(now) : new Date());
  const extensions = validateExtensions(repoRoot);

  const contractViolations = capabilities.filter((c) => !c.contractOk).length;
  const budgetViolations = capabilities.filter((c) => !c.budgetOk).length;
  const missingErrorScenario = capabilities.filter((c) => c.warnings.some((w) => w.includes('error scenario'))).length;

  // Map findings to gates declared in quality/quality-gates.yaml (if present).
  const gatesPath = path.join(repoRoot, 'quality', 'quality-gates.yaml');
  const declaredGates = fs.existsSync(gatesPath) ? (readYaml(gatesPath)?.gates || []) : [];
  const findings = {
    contract: contractViolations,
    example: missingErrorScenario,
    budget: budgetViolations,
    'extension-completeness': extensions.results.filter((r) => !r.ok).length,
    'review-freshness': reviews.length
  };
  const gates = declaredGates.map((g) => {
    const count = findings[g.id] ?? 0;
    const failed = count > 0 && (g.id in findings);
    return { id: g.id, enforced: !!g.enforced, severity: g.severity || 'error', failingCount: count, passed: !failed };
  });

  const enforcedFailures = gates.filter((g) => g.enforced && !g.passed);

  const summary = {
    capabilities: capabilities.length,
    healthy: capabilities.filter((c) => c.contractOk && c.budgetOk).length,
    contractViolations,
    budgetViolations,
    missingErrorScenario,
    overdueReviews: reviews.length,
    extensionIssues: findings['extension-completeness'],
    enforcedGateFailures: enforcedFailures.length
  };

  return { summary, capabilities, reviews, extensions, gates, ok: enforcedFailures.length === 0, config };
}
