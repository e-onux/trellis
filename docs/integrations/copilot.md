# Using Trellis with GitHub Copilot

Copilot reads repository-wide custom instructions from `.github/copilot-instructions.md`. Under Trellis,
that file is a thin pointer to `AGENTS.md`, the single canonical source of agent instructions.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `.github/copilot-instructions.md` | Thin pointer → `AGENTS.md` (no rules of its own) |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

Because the pointer lives one level below the repo root, its links use a `../` prefix
(`[AGENTS.md](../AGENTS.md)`); the generator handles this for you.

## Quickstart

**Option A - agent-native (zero install).**

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Copilot (agent mode):

> "Read `TRELLIS.md` and bootstrap this repository according to it."

**Option B - CLI (deterministic).**

```bash
npx @sidrelabs/trellis init --profile backend --preset standard --agents copilot,claude
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents copilot
```

## How Copilot consumes it

Copilot Chat, agent mode and the Copilot coding agent automatically include
`.github/copilot-instructions.md` in their context - in VS Code, other supported IDEs, and on github.com.
The pointer defers to `AGENTS.md`, which carries the rules and references `TRELLIS.md` and the
[standard](../../standard/README.md). To change a rule, edit `AGENTS.md` - never the pointer.

## Working under Trellis rules

- Before changing code, the agent reads the relevant `capabilities/<id>/contract.yaml` and current ADRs in
  `tech/decisions/`.
- New behavior goes through the budget decision rule: within `responsibility.does` and within budget →
  extend; over budget → stop and write a refactor/split proposal; outside `does` → propose a new capability.
- Stop conditions produce a **proposal instead of code** - that is a valid deliverable under Trellis.
- Substantive work ends with the completion report defined in
  [`TRELLIS.md`](../../TRELLIS.md#completion-report-always).

> **Tip:** run `trellis audit` in CI - a natural fit next to your other GitHub Actions checks. The gates
> then hold regardless of which agent made the change.

## Verify with the CLI

```bash
npx @sidrelabs/trellis validate            # contract structure + budgets
npx @sidrelabs/trellis budget-check        # files / LOC / dependencies vs budgets
npx @sidrelabs/trellis extension validate  # required registration points
npx @sidrelabs/trellis audit               # whole-repo health, CI-friendly exit code
```

See also: [getting started](../getting-started.md) · [Claude Code](./claude-code.md) · [Codex](./codex.md)
