<div align="center">

# 🌿 Trellis

**A capability-first, evidence-governed standard that keeps AI-generated software understandable, testable and maintainable as it grows.**

*Let AI-built software grow without sprawling.*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Standard](https://img.shields.io/badge/spec-Trellis%20Standard%20v0.1-2ea44f.svg)](./standard/README.md)
[![Agent-independent](https://img.shields.io/badge/agents-Claude%20Code%20·%20Codex%20·%20Copilot%20·%20Cursor%20·%20Windsurf%20·%20Gemini-555.svg)](#multi-platform-support)

### 🌐 [**trellis.sidre.site**](https://trellis.sidre.site) - try the wizard

</div>

---

> A trellis doesn't make a plant grow - it keeps it from sprawling. Trellis does the same for software an AI agent builds: it lets the codebase grow while keeping it bounded, verifiable and explainable.

## Why Trellis exists

Generating code is now trivial. **Keeping it under control is not.** When an agent builds feature after feature, the codebase tends to:

- grow without bound - duplicated responsibilities, runaway dependencies, ballooning files;
- drift from its own architecture - locally sensible changes that are globally inconsistent;
- lose the *why* - decisions live in chat history, not in the repository;
- hide its tests - only engineers can see whether a feature actually works;
- forget its sources - technical choices outlive the evidence that justified them.

In 2026, AI writes a large share of production code - but without governance, studies report materially more security defects and far higher long-term maintenance cost. Spec-driven tools tell an agent **what to build**. Trellis preserves **why it was built that way, how each piece is verified, how much it is allowed to grow, and when it must be reconsidered.**

## What Trellis is

Trellis is **not another coding agent**. It is an **agent-independent repository standard** plus a small toolchain that layers on top of the agent you already use (Claude Code, Codex, GitHub Copilot, Cursor, Windsurf, Gemini CLI…).

It is built from parts that exist separately elsewhere - but combines them into one standard that no single tool offers today:

| Pillar | What it does | Where it lives |
|---|---|---|
| 🧠 **Repository-native memory** | Decisions, sources and contracts live in the repo, not in chat history | `governance/`, `tech/` |
| 📐 **Capability contracts** | Every meaningful behavior has a machine-checkable input/output contract | `capabilities/*/contract.yaml` |
| 📊 **Capability budgets** | Technical *and* semantic limits (files, LOC, deps, responsibilities) - enforced | `budgets:` + `trellis budget-check` |
| 🔍 **Evidence graph** | `Source → Claim → Decision → Capability → Test → User validation` | `sources/`, ADR `evidence:` |
| 🗂️ **Decision lifecycle** | ADRs with assumptions, review intervals and re-evaluation triggers | `tech/decisions/` |
| 🧩 **Extension contracts** | Directory-local rules listing the files an extension *must* register | `EXTENSIONS.md`, `extension-registry.yaml` |
| 🖥️ **User-facing test cockpit** | Non-engineers compare expected vs actual output per capability | `/__capabilities` *(Phase 2)* |
| 🛑 **Obligation to *not* write code** | Machine-readable stop conditions; agent proposes split/refactor/ADR instead | `governance/agent-authority.md` |
| 🚦 **Quality gates** | CI gates: contract, budget, drift, evidence, regression | `.github/workflows/`, `quality/quality-gates.yaml` |
| ⏳ **Technology lifecycle** | Upgrade & refactor triggers so decisions don't silently rot | `tech/technology-radar.md` |

## Multi-platform support

Trellis treats [**AGENTS.md**](https://agents.md/) - now stewarded by the Linux Foundation's Agentic AI Foundation and read by 20+ tools - as the **canonical** instruction surface, and generates thin per-tool pointer files so there is a single source of truth:

| Platform | File generated | Role |
|---|---|---|
| **Codex / Jules / Aider / Zed** | `AGENTS.md` | Native (canonical) |
| **Claude Code** | `CLAUDE.md` | Pointer → AGENTS.md |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Pointer → AGENTS.md |
| **Cursor** | `.cursor/rules/trellis.mdc` | Pointer → AGENTS.md |
| **Windsurf** | `.windsurf/rules/trellis.md` | Pointer → AGENTS.md |
| **Gemini CLI** | `GEMINI.md` | Pointer → AGENTS.md |

The repository itself dogfoods this: see [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md), [`.github/copilot-instructions.md`](./.github/copilot-instructions.md).

## Quickstart

There are two ways to adopt Trellis. Both produce the same governed structure.

### Option A - Agent-native (zero install) ⭐

Copy the bootstrap manifesto into your repo and tell your agent to follow it:

```bash
curl -o TRELLIS.md https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

> "Read `TRELLIS.md` and bootstrap this repository according to it."

The agent reads [`TRELLIS.md`](./TRELLIS.md), analyzes the repo, and scaffolds the governance directories, capability contracts and agent adapters itself.

### Option B - CLI (deterministic / CI-friendly)

```bash
# from this monorepo
npm install
node packages/cli/bin/trellis.js --help

# in a target project (once published to npm)
npx @e-onux/trellis init --profile backend --agents claude,codex,copilot --preset standard
npx @e-onux/trellis validate          # contract + budget + drift checks
npx @e-onux/trellis budget-check       # capability size/dependency budgets
npx @e-onux/trellis audit              # whole-repo health report
npx @e-onux/trellis extension validate # extension completeness gate
```

## Progressive adoption

You don't adopt all of Trellis on day one:

```
Level 1  Governance + ADRs            (project memory)
Level 2  Capability contracts          (executable specs)
Level 3  Automated tests               (unit/contract/property)
Level 4  User test cockpit             (human-verifiable surface)
Level 5  Capability & architecture budgets   (anti-bloat enforcement)
Level 6  Lifecycle + upgrade automation      (decisions that don't rot)
```

## Repository layout

```
trellis/
├── TRELLIS.md            ← single bootstrap manifesto (agent-independent)
├── AGENTS.md             ← canonical agent instructions
├── CLAUDE.md  GEMINI.md  .cursor/  .windsurf/  .github/   ← per-tool adapters
├── standard/             ← the open standard
│   ├── README.md         ← spec overview + adoption levels
│   ├── schemas/          ← JSON Schemas (contract, ADR, source, gates, radar, extension)
│   ├── templates/        ← ADR, capability, source, refactor/split/extension templates
│   ├── profiles/         ← backend / frontend / data-pipeline / llm-app defaults
│   └── repo-skeleton/    ← the governed directory tree scaffolded into your repo
├── packages/
│   ├── core/             ← engine: compose (browser-safe), scaffold, budgets, contract & extension validation, audit
│   └── cli/              ← `trellis` command (wraps core)
├── apps/
│   └── web/              ← landing + wizard (static; reuses core's compose engine) → trellis.sidre.site
├── examples/
│   └── calculate-shipping-cost/   ← a fully worked capability
└── docs/
    └── founding-design.md ← the original concept this project grew from
```

## Roadmap

- ✅ **Phase 1** - open standard, schemas, templates, profiles, multi-platform adapters, worked example, and a working CLI (`init` / `validate` / `budget-check` / `audit` / `extension`).
- ✅ **Phase 2 - web wizard & landing site** ([`apps/web`](./apps/web), live at [trellis.sidre.site](https://trellis.sidre.site)): a static browser wizard that, from your choices (platforms, profile, greenfield/brownfield, strictness, modules), produces three outputs from the *same `compose` engine the CLI uses*: **copy the tailored AI spec**, **copy an `npx` command**, or **download a `.zip`** starter.
- ⏳ **Phase 3** - capability health score, architecture-drift detector, and the live test cockpit.

## Status

Early but real. The standard and toolchain are usable today; APIs and schemas may change before `1.0`. Issues and proposals welcome - see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[Apache-2.0](./LICENSE) © Trellis Framework contributors.
