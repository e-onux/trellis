# Getting started

Two ways to adopt Trellis. Both end with the same governed structure.

## A) Agent-native (zero install)

1. Put `TRELLIS.md` in your repo:
   ```bash
   curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
   ```
2. Tell your agent (Claude Code, Codex, Copilot, Cursor, Windsurf, Gemini CLI...):
   > "Read `TRELLIS.md` and bootstrap this repository according to it."

The agent scaffolds governance, extracts decisions into ADRs, discovers capabilities, and generates the
agent adapter files - with `AGENTS.md` as the canonical source.

## B) CLI (deterministic)

From this monorepo:

```bash
npm install
node packages/cli/bin/trellis.js --help
```

In a target project (after publish: `npx @sidrelabs/trellis ...`):

```bash
trellis init --profile backend --preset standard --agents claude,codex,copilot
trellis capability add calculate-shipping-cost   # scaffolds a capability folder
# ...fill in contract.yaml, add a normal + error example...
trellis validate         # contract structure + budgets
trellis budget-check     # files / LOC / declared dependencies vs budgets
trellis extension validate
trellis audit            # whole-repo health + quality gates (CI-friendly exit code)
```

## Choosing a profile

| Profile | Use it for | Emphasis |
|---|---|---|
| `backend` | APIs, domain logic, jobs | contracts + regression |
| `frontend` | web UI, components | user-demo + visual |
| `data-pipeline` | ETL, batch, streaming | property-based (invariants) |
| `llm-app` | prompt pipelines, RAG, agents | evidence + user-demo + tech-radar |

## Presets

- `light` - fewer enforced gates, looser budgets. Start here for an existing (brownfield) codebase.
- `standard` - recommended defaults.
- `strict` - all gates enforced.

## What "done" means

A capability is done when it has a contract, a normal + error example, passing tests, a human-verifiable
surface, respects its budget, preserves invariants, and links current ADRs/sources. See
`governance/definition-of-done.md` in your scaffolded repo.
