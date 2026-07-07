// Git hook installer for model provenance. `trellis hook install` writes:
//   - post-commit : stamps the authoring model for the commit just made (no-op unless
//                   TRELLIS_MODEL is set) - the harness that knows the real model id sets it,
//                   which is more trustworthy than asking the model to self-report.
//   - pre-push    : runs `trellis model-check` (fail-closed, respecting the policy's enforcement
//                   mode) so a disallowed/unverified commit is blocked before it leaves the machine.
// Reads/writes only the git hooks directory; no network. See ADR-0007.
import { fs, path } from './util.js';

const MARK = '# trellis-managed-hook';

export const HOOKS = {
  'post-commit': `#!/bin/sh
${MARK}
# Record which model authored the commit just made. No-op unless TRELLIS_MODEL is set.
[ -n "$TRELLIS_MODEL" ] || exit 0
if command -v trellis >/dev/null 2>&1; then TRELLIS="trellis"; else TRELLIS="npx --no-install @sidrelabs/trellis"; fi
$TRELLIS model-stamp --commit HEAD --model "$TRELLIS_MODEL" \${TRELLIS_AGENT:+--agent "$TRELLIS_AGENT"} >/dev/null 2>&1 || true
`,
  'pre-push': `#!/bin/sh
${MARK}
# Block a push that contains a commit by a disallowed or unverified model.
if command -v trellis >/dev/null 2>&1; then TRELLIS="trellis"; else TRELLIS="npx --no-install @sidrelabs/trellis"; fi
$TRELLIS model-check || {
  echo "trellis: model-policy check failed - push blocked. Run 'trellis model-check' for details." >&2
  exit 1
}
`
};

// Resolve the git hooks directory, handling a normal .git dir and a .git file (worktrees).
function hooksDir(repoRoot) {
  const dotgit = path.join(repoRoot, '.git');
  if (!fs.existsSync(dotgit)) return null;
  const st = fs.statSync(dotgit);
  if (st.isDirectory()) return path.join(dotgit, 'hooks');
  const m = fs.readFileSync(dotgit, 'utf8').match(/gitdir:\s*(.+)/);
  return m ? path.join(path.resolve(repoRoot, m[1].trim()), 'hooks') : null;
}

/**
 * Install the Trellis git hooks. A pre-existing NON-Trellis hook is skipped unless `force`.
 * @param {string} repoRoot
 * @param {{ force?: boolean, only?: 'post-commit'|'pre-push' }} [opts]
 * @returns {{ installed: string[], skipped: Array<{hook:string, reason:string}>, dir: string }}
 */
export function installHooks(repoRoot, { force = false, only } = {}) {
  repoRoot = path.resolve(repoRoot || process.cwd());
  const dir = hooksDir(repoRoot);
  if (!dir) throw new Error('not a git repository (no .git) - run `trellis hook install` inside a git repo');
  fs.mkdirSync(dir, { recursive: true });
  const installed = [];
  const skipped = [];
  for (const [name, body] of Object.entries(HOOKS)) {
    if (only && name !== only) continue;
    const dest = path.join(dir, name);
    if (fs.existsSync(dest) && !force && !fs.readFileSync(dest, 'utf8').includes(MARK)) {
      skipped.push({ hook: name, reason: 'a non-Trellis hook already exists (use --force to overwrite)' });
      continue;
    }
    fs.writeFileSync(dest, body);
    fs.chmodSync(dest, 0o755);
    installed.push(name);
  }
  return { installed, skipped, dir: path.relative(repoRoot, dir) };
}
