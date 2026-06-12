# Using Trellis with Cursor

Cursor reads project rules from `.cursor/rules/`. Under Trellis, the generated rule
`.cursor/rules/trellis.mdc` is a thin pointer to `AGENTS.md`, the single canonical source of agent
instructions.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `.cursor/rules/trellis.mdc` | Thin pointer → `AGENTS.md`, with `alwaysApply: true` |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

The `.mdc` file carries front matter:

```yaml
---
description: Canonical agent rules live in AGENTS.md
alwaysApply: true
---
```

`alwaysApply: true` attaches the rule to every chat and agent session, so the pointer is always in context.
Links inside it use a `../../` prefix because the file sits two levels below the repo root.

## Quickstart

**Option A - agent-native (zero install).**

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Cursor's agent:

> "Read `TRELLIS.md` and bootstrap this repository according to it."

**Option B - CLI (deterministic).**

```bash
npx @e-onux/trellis init --profile backend --preset standard --agents cursor,claude
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents cursor
```

## How Cursor consumes it

Cursor injects always-applied project rules into every conversation. The Trellis rule contains no actual
rules - it sends the agent to `AGENTS.md`, which carries the nine rules and references `TRELLIS.md` and the
[standard](../../standard/README.md). To change a rule, edit `AGENTS.md` - never the `.mdc` pointer.

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

See also: [getting started](../getting-started.md) · [Windsurf](./windsurf.md) · [Claude Code](./claude-code.md)
