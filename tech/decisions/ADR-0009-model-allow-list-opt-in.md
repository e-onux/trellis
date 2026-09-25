# ADR-0009: Make the model allow-list optional (opt-in model-provenance gate)

```yaml
id: ADR-0009
title: Make the model allow-list optional (opt-in model-provenance gate)
status: accepted
date: 2026-09-25

context:
  description: >
    ADR-0005 made model choice a governed axis and ADR-0007 made it enforceable end to end. In practice
    the policy behaved as mandatory: governance/model-policy.yaml shipped placeholder ids
    (your-primary-model, your-secondary-model) with require_provenance: true and enforcement: block,
    AGENTS.md rule 10 told every agent to STOP unless it was on that list, and quality-gates.yaml declared
    model-provenance enforced. A list nobody filled in cannot name any real model, so a literal agent
    stops on every task and an unstamped history fails the gate - on this repository and on any adopter
    who copied the file. Restricting authoring models is a legitimate choice for some teams, not a
    precondition for using Trellis.

decision:
  selected: >
    The model allow-list is opt-in. The check is configured only when governance/model-policy.yaml names
    at least one model in allowed_models or disallow; entries matching the old template placeholders
    (your-*-model) do not count. When the policy is absent, empty or placeholder-only,
    checkModelProvenance returns evaluated: false, configured: false, ok: null - it is reported as
    not evaluated, never as a silent pass and never as a block, so `trellis model-check` and the
    pre-push hook exit 0 with a notice explaining how to opt in. Once configured, ADR-0005 applies
    unchanged (fail-closed, require_provenance, enforce_since, block|warn). The shipped policy file
    (this repo and a new standard/repo-skeleton/governance/model-policy.yaml template) has an empty
    allow-list with commented examples. AGENTS.md rule 10 and the generated rule in compose.js RULES
    apply only when a list is configured. The model-provenance quality gate is declared enforced: false
    (severity warning) in this repo and in the skeleton, and added to the quality-gates schema; adopters
    set it to enforced once they configure a list.

alternatives:
  - Keep the placeholder list and tell adopters to edit it (rejected - a placeholder is never a real
    model id, so the default blocks every agent and every unstamped commit until someone edits it)
  - Treat an empty allow-list as "every model allowed" and pass (rejected - that is a silent pass; the
    audit's gate-honesty rule reports unmeasured gates as not-evaluated, never passed)
  - Delete the model policy from the default repo entirely (rejected - the capability, hooks and
    template stay useful; opt-in keeps them one edit away)
  - Gate opt-in on a separate enabled flag (rejected - a second switch can disagree with the
    list; the presence of a real model id is the single source of truth)

assumptions:
  - Teams that want to restrict models will list real ids; a non-empty list is a deliberate choice.
  - The your-*-model pattern never matches a real vendor model id.
  - Trellis developers working on this repository are not bound by any authoring-model restriction;
    the repo's own policy stays unconfigured unless a later ADR decides otherwise.

consequences:
  positive:
    - Trellis works out of the box - no agent stops and no gate blocks because of an unfilled template.
    - Adopters who copied the old placeholder file are unblocked without editing it.
    - Unconfigured is reported honestly as not evaluated (ok is null), consistent with audit gate honesty.
    - Once configured, the fail-closed guarantees of ADR-0005/ADR-0007 are unchanged.
  negative:
    - A team that relied on the placeholder file to "feel enforced" now gets no restriction until it
      lists real models (it never had a working one - no real id could match).
    - Declaring the gate enforced after opting in is a manual step in quality-gates.yaml; the audit does
      not yet evaluate model-provenance itself (still `trellis model-check`, per ADR-0007).
    - checkModelProvenance returns ok = null instead of ok = true when not evaluated; callers must test
      `evaluated` before `ok`.

review:
  interval: 12 months
  next_review: 2027-09-25
  triggers:
    - model-provenance is wired into `trellis audit` (derive the gate's enforced state from configuration)
    - a model can sign its output (revisit ADR-0005 attestation vs proof)
    - adopters report wanting the allow-list on by default for a profile (e.g. llm-app strict preset)

affected_capabilities:
  - check-model-provenance

migration:
  required: false

rollback:
  available: true
```

## Notes

This **amends** [ADR-0005](./ADR-0005-model-provenance-gate.md) and
[ADR-0007](./ADR-0007-model-provenance-hooks.md) rather than superseding them: their mechanism
(out-of-band provenance, fail-closed check, stamping and pre-push hooks) is unchanged. What changes is
*when* it applies - only after the adopter names a model. Rollback is restoring a non-empty
`allowed_models` and `enforced: true` on the model-provenance gate.
