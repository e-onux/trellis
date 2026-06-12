// Whole-repository audit. Discovers capabilities, validates contracts, runs budget checks,
// checks ADR/source review freshness and reference integrity, runs extension completeness,
// and maps results to quality gates.
//
// Gate honesty: a declared gate that has no wired check is reported as `not-evaluated`,
// never as silently passed. Only a measured, failing, enforced gate fails the build.
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

function collectAdrs(repoRoot) {
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

function loadSources(repoRoot) {
  const bib = path.join(repoRoot, 'sources', 'bibliography.yaml');
  return fs.existsSync(bib) ? (readYaml(bib)?.sources || []) : [];
}

function checkReviewFreshness(adrs, sources, today) {
  const overdue = [];
  for (const { id, doc } of adrs) {
    const next = doc?.review?.next_review;
    if (next && new Date(next) < today) overdue.push({ kind: 'ADR', id, next_review: next });
  }
  for (const s of sources) {
    if (s.next_review && new Date(s.next_review) < today) overdue.push({ kind: 'source', id: s.id, next_review: s.next_review });
  }
  return overdue;
}

// Evidence graph integrity: every reference must resolve.
// ADR evidence ids -> bibliography; capability evidence -> bibliography;
// capability decisions -> ADR ids; source supports -> ADR id or capability id.
function checkReferences(capabilities, adrInfo, sources) {
  const evidenceIssues = [];
  const decisionIssues = [];
  const sourceIds = new Set(sources.map((s) => s.id));
  const capIds = new Set(capabilities.map((c) => c.id));

  for (const { id, doc } of adrInfo.adrs) {
    for (const ev of doc.evidence || []) {
      if (ev?.id && !sourceIds.has(ev.id)) evidenceIssues.push(`${id} cites unknown source "${ev.id}"`);
    }
  }
  for (const c of capabilities) {
    for (const ev of c.evidence) {
      if (!sourceIds.has(ev)) evidenceIssues.push(`${c.id} cites unknown source "${ev}"`);
    }
    for (const d of c.decisions) {
      if (!adrInfo.ids.has(d)) decisionIssues.push(`${c.id} references unknown decision "${d}"`);
    }
  }
  for (const s of sources) {
    for (const target of s.supports || []) {
      const t = String(target);
      const resolves = adrInfo.ids.has(t) || capIds.has(t) || capIds.has(t.replace(/^capability-/, ''));
      if (!resolves) evidenceIssues.push(`${s.id} supports unknown target "${t}"`);
    }
  }
  return { evidenceIssues, decisionIssues };
}

/**
 * @returns {{ summary, capabilities, reviews, references, extensions, gates, ok, config }}
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
      budgetChecks: budget.checks,
      evidence: Array.isArray(contract.evidence) ? contract.evidence : [],
      decisions: Array.isArray(contract.decisions) ? contract.decisions : []
    });
  }

  const adrInfo = collectAdrs(repoRoot);
  const sources = loadSources(repoRoot);
  const reviews = checkReviewFreshness(adrInfo.adrs, sources, now ? new Date(now) : new Date());
  const references = checkReferences(capabilities, adrInfo, sources);
  const extensions = validateExtensions(repoRoot);

  const contractViolations = capabilities.filter((c) => !c.contractOk).length;
  const budgetViolations = capabilities.filter((c) => !c.budgetOk).length;
  const missingErrorScenario = capabilities.filter((c) => c.warnings.some((w) => w.includes('error scenario'))).length;

  // Findings per gate id. A gate id absent from this map has no wired check yet
  // and is reported as not-evaluated.
  const findings = {
    contract: contractViolations,
    example: missingErrorScenario,
    budget: budgetViolations,
    'extension-completeness': extensions.results.filter((r) => !r.ok).length,
    'review-freshness': reviews.length,
    evidence: references.evidenceIssues.length,
    decision: references.decisionIssues.length
  };

  const gatesPath = path.join(repoRoot, 'quality', 'quality-gates.yaml');
  const declaredGates = fs.existsSync(gatesPath) ? (readYaml(gatesPath)?.gates || []) : [];
  const gates = declaredGates.map((g) => {
    const measured = g.id in findings;
    const failingCount = measured ? findings[g.id] : 0;
    const status = !measured ? 'not-evaluated' : (failingCount > 0 ? 'failed' : 'passed');
    return { id: g.id, enforced: !!g.enforced, severity: g.severity || 'error', failingCount, status, passed: status === 'passed' };
  });

  const enforcedFailures = gates.filter((g) => g.enforced && g.status === 'failed');

  const summary = {
    capabilities: capabilities.length,
    healthy: capabilities.filter((c) => c.contractOk && c.budgetOk).length,
    contractViolations,
    budgetViolations,
    missingErrorScenario,
    overdueReviews: reviews.length,
    brokenEvidenceLinks: references.evidenceIssues.length,
    brokenDecisionLinks: references.decisionIssues.length,
    extensionIssues: findings['extension-completeness'],
    gatesNotEvaluated: gates.filter((g) => g.status === 'not-evaluated').length,
    enforcedGateFailures: enforcedFailures.length
  };

  return { summary, capabilities, reviews, references, extensions, gates, ok: enforcedFailures.length === 0, config };
}
