# Using Trellis with Gemini CLI

Gemini CLI loads `GEMINI.md` from the project root as its default context file. Under Trellis, that file is
a thin pointer to `AGENTS.md`, the single canonical source of agent instructions.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `GEMINI.md` | Thin pointer → `AGENTS.md` (no rules of its own) |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

## Quickstart

**Option A - agent-native (zero install).**

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Gemini CLI:

> "Read `TRELLIS.md` and bootstrap this repository according to it."

**Option B - CLI (deterministic).**

```bash
npx @e-onux/trellis init --profile backend --preset standard --agents gemini,claude
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents gemini
```

## How Gemini CLI consumes it

Gemini CLI hierarchically discovers `GEMINI.md` files (project root and parent/child directories) and loads
them into context at startup. The Trellis-generated `GEMINI.md` contains no rules - it sends the agent to
`AGENTS.md`, which carries the nine rules and references `TRELLIS.md` and the
[standard](../../standard/README.md). To change a rule, edit `AGENTS.md` - never the pointer.

## Working under Trellis rules

- Before changing code, the agent reads the relevant `capabilities/<id>/contract.yaml` and current ADRs in
  `tech/decisions/`.
- New behavior goes through the budget decision rule: within `responsibility.does` and within budget →
  extend; over budget → stop and write a refactor/split proposal; outside `does` → propose a new capability.
- Stop conditions produce a **proposal instead of code** - that is a valid deliverable under Trellis.
- Substantive work ends with the completion report defined in
  [`TRELLIS.md`](../../TRELLIS.md#completion-report-always).

> **Tip:** run `trellis audit` in CI. The gates then hold regardless of which agent made the change.

## Verify with the CLI

```bash
npx @e-onux/trellis validate            # contract structure + budgets
npx @e-onux/trellis budget-check        # files / LOC / dependencies vs budgets
npx @e-onux/trellis extension validate  # required registration points
npx @e-onux/trellis audit               # whole-repo health, CI-friendly exit code
```

See also: [getting started](../getting-started.md) · [Claude Code](./claude-code.md) · [Codex](./codex.md)
