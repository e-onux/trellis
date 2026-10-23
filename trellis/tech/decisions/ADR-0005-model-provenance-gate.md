# ADR-0005: Govern which models may author code (model-provenance gate)

```yaml
id: ADR-0005
title: Govern which models may author code (model-provenance gate)
status: accepted
date: 2026-06-18

context:
  description: >
    Coding agents can silently fall back to a weaker model (rate limits, outages, a
    misconfigured default). The degraded model then ships code that erodes a project - exactly
    the failure Trellis exists to prevent, but on the authorship axis rather than the
    contract/budget axis. There was no way to declare "only these models may write code here"
    or to verify, after the fact, which model authored a commit.

decision:
  selected: >
    Add model choice as a governed axis. governance/model-policy.yaml declares an allow-list of
    permitted models, an optional block-list, and an enforcement window (enforce_since). A new
    capability, check-model-provenance, joins the commits in that window with provenance recorded
    out-of-band in .trellis/provenance.jsonl (one JSON record per line:
    { commit, model, agent, at }) and classifies each commit allowed | disallowed | unverified.
    `trellis model-check` is fail-closed: a disallowed model - or, when require_provenance is true,
    a commit with no recorded model - is a violation and exits non-zero, so CI or a pre-push hook
    can BLOCK the merge before bad-model code lands. `trellis model-stamp` records provenance.
    The allowed models are also surfaced as an advisory rule in AGENTS.md so a capable agent
    refuses up front. Provenance is local-only, no network.

alternatives:
  - Prompt-only enforcement (rejected as the sole mechanism - advisory; the degraded fallback is
    the model least likely to honour it, so it cannot be the only line of defence)
  - A Trellis-Model commit trailer (rejected as default - it adds a line to every commit message;
    out-of-band storage keeps history clean, matching the repo's no-attribution commit convention)
  - Automatically revert code authored by a disallowed model (rejected as a default - blocking
    before merge is strictly safer, and silently reverting in an agent loop can destroy legitimate
    human edits layered on top; revert stays an explicit, reviewed, opt-in action)
  - Cryptographically prove which model wrote code (not possible today - models do not sign their
    output; attestation plus a fail-closed gate is the realistic trust model, like DCO / signed-off-by)

assumptions:
  - The recorded provenance is an attestation, not proof; fail-closed plus branch protection makes
    forgery the only bypass, and forgery leaves an auditable trail.
  - The most trustworthy stamp comes from the harness (which knows the real model id), not the
    model's self-report; a stamping hook is the intended writer of .trellis/provenance.jsonl.
  - History before enforce_since is exempt; provenance is required only going forward.

consequences:
  positive:
    - Which model may author code is now a declarable, machine-checkable axis with an audit trail.
    - Fail-closed blocking happens before merge, where it is cheap, not via destructive after-the-fact revert.
    - Commit messages stay clean - provenance lives out-of-band.
    - Obsidian-style external tools and CI can read the same provenance log; no network.
  negative:
    - Provenance depends on a stamping step being wired (a hook); without it, require_provenance
      flags every commit as unverified, so adopters must install the hook or set warn enforcement.
    - The gate is not yet wired into `trellis audit` (which stays git-free); it runs as the separate
      `trellis model-check` command until a stamping hook lands (tracked in ROADMAP).

review:
  interval: 12 months
  next_review: 2027-06-18
  triggers:
    - a model gains the ability to sign its output (revisit attestation vs proof)
    - the stamping hook lands (wire the gate into audit; reconsider enforce_since defaults)
    - provenance storage needs to move (git notes, a different sidecar) or gains network behaviour

affected_capabilities:
  - check-model-provenance

migration:
  required: false

rollback:
  available: true
```

## Notes

The trust boundary is deliberately honest: an **advisory prompt** stops a cooperative agent, an
**out-of-band attestation** records which model authored each commit, and a **fail-closed gate**
blocks anything unverified or disallowed from merging. None of this claims to *prove* authorship -
it raises the bar to the same level as `Signed-off-by`/DCO and makes the one bypass (deliberate
forgery) auditable. Reverting already-landed code is intentionally **not** automatic; the gate
prevents the merge instead.
