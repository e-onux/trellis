# Project Constitution - Trellis monorepo

> This repository defines the Trellis standard and follows it. These rules bind both humans and agents
> working here. The generic version users scaffold lives in `standard/repo-skeleton/governance/`.

1. Every engine behavior shipped to users is a **capability contract** under `capabilities/`.
2. Changes to the standard (`standard/schemas/**`, the directory model) require an **ADR** in `tech/decisions/`.
3. `packages/core` stays **dependency-light and browser-safe**; the CLI is a thin wrapper.
4. `AGENTS.md` is the **single source of truth** for agent rules; pointer files never carry rules.
5. A capability over budget gets a **split or refactor proposal**, not more code.
6. `npm test`, `npm run selfcheck` and `trellis audit --root .` must stay green; CI enforces all three.
7. Claims need **evidence or a test**, in this repo as much as in governed repos.
