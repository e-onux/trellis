// Model-provenance policy: which models may author commits, and a fail-closed check that an
// allow-listed model is recorded for every commit in the enforcement window.
//
// Opt-in (ADR-0009): the check is evaluated only when the policy names at least one model
// (allowed_models or disallow). An absent/empty list - or one still holding the template
// placeholders - is reported as not evaluated: never a silent pass, never a block.
//
// Provenance is stored out-of-band in .trellis/provenance.jsonl (one JSON record per line:
// { "commit": "<sha>", "model": "<id>", "agent": "<id>", "at": "<iso>" }) so commit messages
// stay clean. Reads only local files + `git log`; no network. See ADR-0005.
import { fs, path } from './util.js';
import { readYaml } from './yaml.js';
import { execFileSync } from 'node:child_process';

export const PROVENANCE_FILE = '.trellis/provenance.jsonl';
const POLICY_FILE = 'governance/model-policy.yaml';
// Ids shipped by earlier templates ("your-primary-model"); never a real model, so never configuration.
const PLACEHOLDER = /^your-[a-z0-9-]*model$/i;

/**
 * Load governance/model-policy.yaml, or null when the repo declares no policy.
 * `configured` is false until the policy names a real model; the check is then not evaluated.
 */
export function loadModelPolicy(repoRoot) {
  const file = path.join(repoRoot, POLICY_FILE);
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

/** Read .trellis/provenance.jsonl into a Map<commitSha, record>. Last write wins; bad lines skip. */
export function readProvenance(repoRoot) {
  const map = new Map();
  const file = path.join(repoRoot, PROVENANCE_FILE);
  if (!fs.existsSync(file)) return map;
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
  const file = path.join(repoRoot, PROVENANCE_FILE);
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
  const policy = loadModelPolicy(repoRoot);
  if (!policy) return notEvaluated('no governance/model-policy.yaml');
  if (!policy.configured) return notEvaluated('model allow-list not configured (allowed_models is empty or holds only template placeholders)');
  if (!isGitRepo(repoRoot)) return notEvaluated('not a git repository', true);
  let commits;
  try {
    commits = listCommits(repoRoot, since || policy.enforceSince);
  } catch (e) {
    return notEvaluated(`git rev-list failed: ${e.message}`, true);
  }
  const { results, violations, ok } = classifyCommits(commits, readProvenance(repoRoot), policy);
  return { evaluated: true, ok, configured: true, enforcement: policy.enforcement, policy, results, violations };
}
