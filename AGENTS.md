# AGENTS.md

> **Canonical** agent instructions for the Trellis monorepo. All other agent files
> (`CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`)
> are thin pointers to this file. Do not duplicate rules into them - that creates a second, drifting
> source of truth (rule #8 below).

This repository is **self-hosting**: it defines the Trellis standard *and* follows it. When in doubt, the
behavior we ship to users is the behavior we apply here.

## What this repo is

The bare framework: the standard plus the toolchain, nothing else.

- `standard/` - the open standard: `schemas/`, `templates/`, `profiles/`, `repo-skeleton/`, and `README.md`.
- `packages/core/` - pure ESM engine (scaffold, budgets, contract/extension validation, audit). **Must run in
  both Node and the browser** - keep Node-only APIs out of modules the website's wizard imports.
- `packages/cli/` - the thin `trellis` Node command that wraps core.
- `examples/` - a fully worked capability (`calculate-shipping-cost`) used by `npm run selfcheck`.

The website (landing + wizard, vibecodegovern.com) is maintained in a separate workspace outside this
repository; it consumes `packages/core/src/compose.js` and `standard/` from a checkout of this repo
(see ADR-0003). Marketing material lives outside the repository entirely.

Read [`TRELLIS.md`](./TRELLIS.md) and [`standard/README.md`](./standard/README.md) before substantive work.

## How to work here

- **Build/test:** `npm install` then `npm test` and `npm run selfcheck`. Both must stay green.
- **Changing the standard** (`standard/schemas/**`, the directory model): include an **ADR** under
  `tech/decisions/` and keep the matching template + schema in sync. Schemas are versioned.
- **Changing core:** keep it dependency-light and browser-safe; the CLI is just a wrapper.
- **Adapters:** edit `AGENTS.md` (here); regenerate/sync pointers - never hand-edit rules into pointer files.

## The rules (same ones Trellis enforces on users)

1. **Capability-first** - every feature maps to a capability contract.
2. **Done ≠ code written** - contract + examples + passing tests + human-verifiable surface + budget + current ADRs.
3. **Budgets are hard limits** - fits `does` & within budget → extend; over budget → STOP, write a proposal.
4. **Obligation to NOT write code** - on a stop condition, produce a split/refactor/ADR/migration proposal instead.
5. **Decisions are conditional** - ADRs carry assumptions + review triggers; supersede, never delete.
6. **Evidence over confidence** - back claims with a source or a test.
7. **Registration over convention** - update every required extension registration point.
8. **Single source of truth** - never duplicate rules across adapter files.
9. **Repository is the memory** - persist decisions/sources/contracts in the repo, not in chat.
10. **Authorized models only** - [`governance/model-policy.yaml`](./governance/model-policy.yaml) lists the
    models permitted to author code here. If you are not one of them - or you are a degraded/fallback
    model - **STOP and tell the user to switch models; do not write code.** Authorship is verified
    out-of-band (`trellis model-check`); a disallowed or unverified author fails the gate.

## Completion report

End substantive work with the report format defined in [`TRELLIS.md`](./TRELLIS.md#completion-report-always).
