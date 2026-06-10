# The Trellis Standard - v0.1

> Status: **draft**. Human-readable here; machine-checkable via [`schemas/`](./schemas).
> This document defines the directory model, artifacts, evidence graph, and quality gates that make up Trellis.

Trellis is **agent-independent**. Nothing here depends on a specific coding agent; the agent-facing files
([`AGENTS.md`](../AGENTS.md) and friends) are *adapters* over this standard, never a second source of truth.

## 1. Core principle

> Every meaningful capability of an application must be a **bounded, independently runnable, automatically
> testable** unit with a **machine-checkable contract**, whose **expected vs actual output a human can compare** -
> and every meaningful **decision** behind it must be **recorded, justified by evidence, and reviewable**.

Two halves, one standard:

1. **Repository governance** - decisions, sources, architectural limits, technology lifecycle.
2. **Executable capabilities** - input/output contracts, examples, invariants, tests, budgets, a user-facing surface.

## 2. Directory model

A Trellis-governed repository contains (subset depending on adoption level):

```
governance/   constitution, engineering principles, agent authority, definition of done, change & approval policy
product/      vision, constraints, domain model, terminology, non-goals, user journeys
tech/         overview, architecture map, technology radar, upgrade/refactor/dependency policy, decisions/ (ADRs)
sources/      MANIFEST, bibliography.yaml, and (license-permitting) local copies - the evidence store
extensions/   EXTENSIONS.md, extension-registry.yaml, extension-contract schema, per-type rules
capabilities/ index, capability-map.yaml, and one folder per capability (contract + examples + tests + evidence)
quality/      testing strategy, security policy, performance budgets, architecture invariants, quality-gates.yaml
lifecycle/    review calendar, technical debt, migrations, deprecations, upgrade reviews, refactor proposals
```

The scaffolded version of this tree lives in [`repo-skeleton/`](./repo-skeleton) and is what `trellis init` copies in.

## 3. Artifacts & schemas

| Artifact | File(s) | Schema |
|---|---|---|
| Capability contract | `capabilities/<id>/contract.yaml` | [`capability-contract.schema.json`](./schemas/capability-contract.schema.json) |
| Architecture decision | `tech/decisions/ADR-XXXX-*.md` (YAML front matter) | [`adr.schema.json`](./schemas/adr.schema.json) |
| Source / evidence | `sources/bibliography.yaml` entries | [`source.schema.json`](./schemas/source.schema.json) |
| Extension contract | `<dir>/extension-registry.yaml` | [`extension-contract.schema.json`](./schemas/extension-contract.schema.json) |
| Quality gates | `quality/quality-gates.yaml` | [`quality-gates.schema.json`](./schemas/quality-gates.schema.json) |
| Technology radar | `tech/technology-radar.yaml` | [`technology-radar.schema.json`](./schemas/technology-radar.schema.json) |

Templates for each live in [`templates/`](./templates).

## 4. Capability budgets (anti-bloat)

A capability may not grow without bound. Budgets are **technical** (files, LOC, dependencies, public operations,
tables, services, complexity) and **semantic** (`responsibility.does` / `does_not`, `max_change_reasons`).

The decision rule an agent applies to new behavior:

```
Does the new behavior fit responsibility.does?
  yes → within budget? → extend the capability
                       → over budget? → STOP, write a refactor/split proposal
  no  → conflicts with does_not / new domain / new dependency? → propose a NEW capability
```

This is the project's defining stance: **the agent has an obligation to *not* write code** when limits are hit,
and to produce a proposal (split / refactor / ADR / migration) instead. See `governance/agent-authority.md`.

## 5. Evidence graph

Sources are not just archived; they are linked end-to-end:

```
Source → Claim → Decision (ADR) → Capability → Implementation → Test → User validation
```

This makes questions answerable: *which source backs this decision? if this source is invalidated, which code must
be reviewed? if this decision changes, which tests rerun?* Default to **metadata-only** for sources; store local
copies of PDFs/DOCX only when the license or ownership permits.

## 6. Decisions are conditional

Every ADR carries **assumptions**, a **review interval**, and **re-evaluation triggers**. A decision that was right
last year is not assumed right today. Superseded decisions are marked `superseded`, never deleted - the history is
part of project memory.

## 7. Extension registration contracts

Adding a plugin/module/provider usually means touching many registries, configs, docs and tests - and those steps
get forgotten. Each extension point carries a directory-local `EXTENSIONS.md` (human guide) plus a machine-readable
`extension-registry.yaml` listing the files that **must** be updated to add - and to **remove** - an extension.
`trellis extension validate` checks completeness and scans for orphans.

## 8. Quality gates

Evaluated by `trellis audit` and CI. Configured in `quality/quality-gates.yaml`:

| Gate | Asks |
|---|---|
| `contract` | Does every public capability have a contract? |
| `example` | Does every capability have a normal *and* an error scenario? |
| `test` | Do mandatory tests pass? |
| `budget` | Are technical & semantic budgets respected? |
| `decision` | Is new tech/architecture recorded in an ADR? |
| `evidence` | Do critical decisions have sources? |
| `drift` | Has code diverged from architecture invariants? |
| `user-visibility` | Is each capability runnable in the cockpit? |
| `regression` | Did previously-working capabilities break? |
| `extension-completeness` | Are all required registration points updated? |
| `review-freshness` | Are any ADR/source reviews overdue? |

A gate with `enforced: true` returns a non-zero exit code and fails the build.

## 9. Progressive adoption

```
Level 1  Governance + ADRs                  (project memory)
Level 2  Capability contracts               (executable specs)
Level 3  Automated tests
Level 4  User test cockpit                  (human-verifiable surface)
Level 5  Capability & architecture budgets  (anti-bloat enforcement)
Level 6  Lifecycle + upgrade automation
```

Adopt incrementally. `trellis init --preset` chooses a starting level (`light`, `standard`, `strict`).

## 10. Design principles

- **Human-readable, machine-verifiable** - Markdown for humans, YAML/JSON Schema for automation.
- **Single source of truth** - never duplicate a rule across agent adapter files.
- **Minimum useful documentation** - every file exists for a real decision, contract or control.
- **Fail visibly** - a broken capability is visible, never silent.
- **Refactor before collapse** - budget breaches trigger refactor *before* the code rots.
- **Evidence over confidence** - an agent's confident assertion never substitutes for a source or a test.
- **Registration over convention** - required wiring is declared, not left to memory.
- **Local rules near the extension point** - extension rules live next to the code they govern.

## Versioning

The standard is versioned independently of the toolchain. Breaking schema changes bump the standard's minor
version pre-1.0 and require an ADR in this repository's own `tech/decisions/`.
