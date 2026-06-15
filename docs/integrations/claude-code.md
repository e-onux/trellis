# Using Trellis with Claude Code

Claude Code reads `CLAUDE.md` automatically. Under Trellis, that file is a thin pointer to `AGENTS.md`,
the single canonical source of agent instructions - rules are never duplicated into it.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `CLAUDE.md` | Thin pointer → `AGENTS.md` (no rules of its own) |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

## Quickstart

**Option A - agent-native (zero install).** Put the bootstrap manifesto in your repo and let Claude Code do
the rest:

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Claude Code:

> "Read `TRELLIS.md` and bootstrap this repository according to it."

It detects the stack, scaffolds governance, extracts decisions into ADRs, discovers capabilities, and
generates `AGENTS.md` plus the `CLAUDE.md` pointer.

**Option B - CLI (deterministic).**

```bash
npx @sidrelabs/trellis init --profile backend --preset standard --agents claude,codex
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents claude
```

## How Claude Code consumes it

Claude Code loads `CLAUDE.md` at the start of every session. The pointer sends it to `AGENTS.md`, which
carries the rules and references `TRELLIS.md` and the [standard](../../standard/README.md). One source of
truth: if you want to change a rule, edit `AGENTS.md` - never the pointer.

## Working under Trellis rules

Day to day, a Trellis-governed session looks like this:

- Before touching code, the agent reads the relevant `capabilities/<id>/contract.yaml` and the current ADRs
  in `tech/decisions/` - the repository, not the chat, is the memory.
- New behavior goes through the budget decision rule: fits `responsibility.does` and within budget → extend;
  over budget → stop and write a refactor/split proposal; outside `does` → propose a new capability.
- When a stop condition fires (budget exceeded, conflict with `does_not`, unknown rationale, new
  architectural dependency, ...), Claude Code produces a **proposal instead of code**. A proposal is a valid
  deliverable.
- Substantive work ends with the completion report from [`TRELLIS.md`](../../TRELLIS.md#completion-report-always):

```
Implementation completed.
- N capability contracts evaluated
- N passed
- N require user validation
- N architecture/budget violations
- ...
```

> **Tip:** run `trellis audit` in CI. The gates then hold regardless of which agent (or human) made the
> change - agent-side rules are guidance, CI gates are enforcement.

## Verify with the CLI

```bash
npx @sidrelabs/trellis validate            # contract structure + budgets
npx @sidrelabs/trellis budget-check        # files / LOC / dependencies vs budgets
npx @sidrelabs/trellis extension validate  # required registration points
npx @sidrelabs/trellis audit               # whole-repo health, CI-friendly exit code
```

See also: [getting started](../getting-started.md) · [Codex](./codex.md) · [Cursor](./cursor.md)
