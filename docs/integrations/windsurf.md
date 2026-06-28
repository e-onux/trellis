# Using Trellis with Windsurf

Windsurf's Cascade agent reads rules from `.windsurf/rules/`. Under Trellis, the generated rule
`.windsurf/rules/trellis.md` is a thin pointer to `AGENTS.md`, the single canonical source of agent
instructions.

## What gets generated

| File | Role |
|---|---|
| `AGENTS.md` | Canonical instructions: the nine Trellis rules, profile, links to the standard |
| `.windsurf/rules/trellis.md` | Thin pointer → `AGENTS.md`, with trigger `always_on` |
| `.trellis.yaml` | Profile, preset, agents, enabled modules |
| `governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/` | The governed tree |

The rule file carries front matter:

```yaml
---
trigger: always_on
---
```

`always_on` applies the rule to every Cascade conversation, so the pointer is always in context. Links
inside it use a `../../` prefix because the file sits two levels below the repo root.

## Quickstart

**Option A - agent-native (zero install).**

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

Then tell Cascade:

> "Read `TRELLIS.md` and bootstrap this repository according to it."

**Option B - CLI (deterministic).**

```bash
npx @sidrelabs/trellis init --profile backend --preset standard --agents windsurf,claude
# or, inside this monorepo:
node packages/cli/bin/trellis.js init --profile backend --preset standard --agents windsurf
```

## How Windsurf consumes it

Cascade loads always-on workspace rules at the start of every conversation. The Trellis rule contains no
actual rules - it sends the agent to `AGENTS.md`, which carries the nine rules and references `TRELLIS.md`
and the [standard](../../standard/README.md). To change a rule, edit `AGENTS.md` - never the pointer.

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
npx @sidrelabs/trellis validate            # contract structure + budgets
npx @sidrelabs/trellis budget-check        # files / LOC / dependencies vs budgets
npx @sidrelabs/trellis extension validate  # required registration points
npx @sidrelabs/trellis audit               # whole-repo health, CI-friendly exit code
```

See also: [getting started](../getting-started.md) · [Cursor](./cursor.md) · [Claude Code](./claude-code.md)
