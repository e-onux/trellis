// Model-provenance policy: which models may author commits, and a fail-closed check that an
// allow-listed model is recorded for every commit in the enforcement window.
//
// Opt-in (ADR-0009): the check is evaluated only when the policy names at least one model
// (allowed_models or disallow). An absent/empty list - or one still holding the template
// placeholders - is reported as not evaluated: never a silent pass, never a block.
//
// Provenance is stored out-of-band in the governed root (trellis/provenance.jsonl; legacy
// .trellis/provenance.jsonl) as one JSON record per line:
// { "commit": "<sha>", "model": "<id>", "agent": "<id>", "at": "<iso>" } so commit messages
// stay clean. Reads only local files + `git log`; no network. See ADR-0005.
import { fs, path } from './util.js';
import { readYaml } from './yaml.js';
import { loadConfig, areaDir, provenancePath } from './config.js';
import { execFileSync } from 'node:child_process';

// Legacy default location, kept as a public constant for API stability. The live path is resolved
// per-repo via provenancePath() so it tracks the governed root (`trellis/` or legacy `.trellis/`).
export const PROVENANCE_FILE = '.trellis/provenance.jsonl';
// Ids shipped by earlier templates ("your-primary-model"); never a real model, so never configuration.
const PLACEHOLDER = /^your-[a-z0-9-]*model$/i;

/**
 * Load the repo's model-policy (governance/model-policy.yaml), or null when none is declared.
 * `configured` is false until the policy names a real model; the check is then not evaluated.
 */
export function loadModelPolicy(repoRoot, config = loadConfig(repoRoot)) {
  const file = areaDir(repoRoot, config, 'governance', 'model-policy.yaml');
  if (!fs.existsSync(file)) return null;
  const raw = readYaml(file) || {};
  const list = (v) => (Array.isArray(v) ? v : []).map(String).filter((m) => m.trim() && !PLACEHOLDER.test(m));
  const allowed = list(raw.allowed_models);
  const disallow = list(raw.disallow);
  return {
    configured: allowed.length > 0 || disallow.length > 0,
    allowed,
    disallow,
    requireProvenance: raw.require_provenance !== false, // default fail-closed (once configured)
    enforceSince: raw.enforce_since ? String(raw.enforce_since) : null,
    enforcement: raw.enforcement === 'warn' ? 'warn' : 'block'
  };
}

/** Read the provenance log into a Map<commitSha, record>. Last write wins; bad lines skip. */
export function readProvenance(repoRoot, config = loadConfig(repoRoot)) {
  const map = new Map();
  let file = provenancePath(repoRoot, config);
  if (!fs.existsSync(file)) {
    const legacy = path.join(repoRoot, '.trellis', 'provenance.jsonl');
    if (!fs.existsSync(legacy)) return map;
    file = legacy; // read a pre-consolidation log if the repo still has one
  }
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const rec = JSON.parse(s);
      if (rec && rec.commit) map.set(String(rec.commit), rec);
    } catch { /* skip malformed line */ }
  }
  return map;
}

/** Append a provenance record for one commit. The intended writer is a post-commit hook. */
export function stampProvenance(repoRoot, { commit, model, agent, at } = {}) {
  if (!commit || !model) throw new Error('stampProvenance requires { commit, model }');
  const rec = { commit: String(commit), model: String(model) };
  if (agent) rec.agent = String(agent);
  rec.at = at || new Date().toISOString();
  const file = provenancePath(repoRoot, loadConfig(repoRoot));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(rec) + '\n');
  return rec;
}

/**
 * Pure classifier: tag each commit against the policy + provenance. No git, no fs.
 * status: allowed | disallowed | unverified | exempt.
 * @param {string[]} commits commit shas in the enforcement window
 * @param {Map<string, {model?:string}>} provenance
 * @param {{allowed:string[],disallow:string[],requireProvenance:boolean}} policy
 * @returns {{ results: Array<{commit,model,status}>, violations: Array, ok: boolean }}
 */
export function classifyCommits(commits, provenance, policy) {
  const allowed = new Set(policy.allowed || []);
  const blocked = new Set(policy.disallow || []);
  const results = commits.map((commit) => {
    const model = provenance.get(commit)?.model || null;
    let status;
    if (!model) status = policy.requireProvenance ? 'unverified' : 'exempt';
    else if (blocked.has(model)) status = 'disallowed';
    else if (allowed.size && !allowed.has(model)) status = 'disallowed';
    else status = 'allowed';
    return { commit, model, status };
  });
  const violations = results.filter((r) => r.status === 'disallowed' || r.status === 'unverified');
  return { results, violations, ok: violations.length === 0 };
}

function isGitRepo(repoRoot) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch { return false; }
}

// List commit shas in the window. A YYYY-MM-DD `since` is matched with `git --since`; anything
// else is treated as a ref and we take `<ref>..HEAD`.
function listCommits(repoRoot, since) {
  let args;
  if (!since) args = ['rev-list', 'HEAD'];
  else if (/^\d{4}-\d{2}-\d{2}/.test(since)) args = ['rev-list', `--since=${since}`, 'HEAD'];
  else args = ['rev-list', `${since}..HEAD`];
  const out = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

const notEvaluated = (reason, configured = false) => ({ evaluated: false, ok: null, configured, reason });

/**
 * Fail-closed model-provenance check over the commits in the enforcement window.
 * Not evaluated (ok: null - neither pass nor fail) when the repo declares no policy, the policy
 * names no model (opt-in, ADR-0009), or the repo is not a git repository.
 * @returns {{ evaluated:boolean, ok:boolean|null, configured:boolean, enforcement?:string, results?, violations?, reason? }}
 */
export function checkModelProvenance(repoRoot, { since } = {}) {
  repoRoot = path.resolve(repoRoot || process.cwd());
  const config = loadConfig(repoRoot);
  const policy = loadModelPolicy(repoRoot, config);
  if (!policy) return notEvaluated('no model-policy.yaml');
  if (!policy.configured) return notEvaluated('model allow-list not configured (allowed_models is empty or holds only template placeholders)');
  if (!isGitRepo(repoRoot)) return notEvaluated('not a git repository', true);
  let commits;
  try {
    commits = listCommits(repoRoot, since || policy.enforceSince);
  } catch (e) {
    return notEvaluated(`git rev-list failed: ${e.message}`, true);
  }
  const { results, violations, ok } = classifyCommits(commits, readProvenance(repoRoot, config), policy);
  return { evaluated: true, ok, configured: true, enforcement: policy.enforcement, policy, results, violations };
}
