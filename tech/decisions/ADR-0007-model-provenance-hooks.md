# ADR-0007: Ship git hooks for model-provenance stamping and pre-push enforcement

```yaml
id: ADR-0007
title: Ship git hooks for model-provenance stamping and pre-push enforcement
status: accepted
date: 2026-06-28

context:
  description: >
    ADR-0005 shipped the model policy but left stamping to a manual `trellis model-stamp` step, and
    it noted the reliable writer - a hook - as deferred. Without automatic stamping, require_provenance
    flags every new commit as unverified, so adopters cannot practically run the gate in block mode.
    The most trustworthy source of the model id is the harness that actually ran the model, not the
    model asked to name itself.

decision:
  selected: >
    Add `trellis hook install`, which writes two zero-dependency shell hooks into the repo's git hooks
    directory. post-commit stamps the commit just made via `trellis model-stamp` using the TRELLIS_MODEL
    (and optional TRELLIS_AGENT) environment variables - a no-op when TRELLIS_MODEL is unset - so the
    harness sets the real id rather than the model self-reporting. pre-push runs `trellis model-check`
    and blocks the push when it fails, respecting the policy's own enforcement mode. Installation is
    opt-in and reversible; a pre-existing non-Trellis hook is not overwritten without --force.

alternatives:
  - A husky-style dependency to manage hooks (rejected - violates the zero-dependency principle)
  - Distribute hooks via core.hooksPath templating (rejected - an explicit opt-in install is clearer
    and easier to reverse than repointing a global git setting)
  - Have the model write its own id into a commit trailer (rejected - less trustworthy than the harness
    environment, and it pollutes commit messages, which the out-of-band store exists to avoid)
  - Auto-install the hooks during `trellis init` (rejected - installing local hooks is a per-clone trust
    decision, not a scaffold artifact)

assumptions:
  - The harness or agent exports TRELLIS_MODEL as the real model id; this is more trustworthy than a
    model self-report and is the writer the design assumes.
  - The trellis CLI is resolvable at hook time (a global install or npx); the hook falls back to npx.
  - Hooks live under .git and are not version-controlled, so each clone installs them once.

consequences:
  positive:
    - Model policy becomes usable end to end - declare, then auto-stamp on commit, then block before push.
    - The reliable writer is the harness environment, not a model naming itself.
    - Zero dependencies; a foreign hook is preserved unless the user forces an overwrite.
  negative:
    - Hooks are per-clone and not version-controlled, so they must be installed after cloning.
    - Wiring model-provenance into `trellis audit` stays deferred until a repo adopts stamping and sets
      a clean enforce_since baseline, so audit does not flag its own unstamped history.

review:
  interval: 12 months
  next_review: 2027-06-28
  triggers:
    - a repo adopts stamping, so the model-provenance gate can finally be wired into `trellis audit`
    - git changes its hook mechanism or default hooks path
    - hooks need to be distributed to many repos at once (reconsider core.hooksPath)

affected_capabilities: []

migration:
  required: false

rollback:
  available: true
```

## Notes

This resolves the ADR-0005 review trigger "the stamping hook lands". The honest chain is now complete:
an advisory prompt asks a cooperative agent to use an allowed model, `trellis hook install` records the
real model the harness ran (post-commit) and blocks a disallowed or unverified author before the push
(pre-push), and none of it claims cryptographic proof.
