# Using Trellis with Codex

Codex reads `AGENTS.md` natively, and `AGENTS.md` is exactly the file Trellis treats as canonical - so this
is the simplest integration of all: **no pointer file is generated**. The same applies to other tools that
read `AGENTS.md` directly, such as Jules, Aider and Zed.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

Passing `--agents codex` is accepted but intentionally produces no extra file - Codex already reads the
canonical source.

## Quickstart

**Option A - agent-native (zero install).**

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Codex:

> "Read `TRELLIS.md` and bootstrap this repository according to it."

**Option B - CLI (deterministic).**

```bash
npx @e-onux/trellis init --profile backend --preset standard --agents codex,claude
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents codex
```

## How Codex consumes it

Codex picks up `AGENTS.md` from the repository root (and nested directories, nearest file winning) without
any configuration. Since Trellis writes its rules straight into `AGENTS.md`, Codex sees the canonical
instructions with zero indirection. To change a rule, edit `AGENTS.md` - there is nothing else to sync.

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

See also: [getting started](../getting-started.md) · [Claude Code](./claude-code.md) · [Copilot](./copilot.md)
