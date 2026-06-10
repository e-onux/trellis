# Contributing to Trellis

Thanks for your interest. Trellis is both an **open standard** and a **toolchain**, so contributions fall into a few buckets. Please read the relevant section before opening a PR.

## Ground rules

Trellis is self-hosting: this repository follows its own standard. Before contributing, skim [`TRELLIS.md`](./TRELLIS.md) and [`standard/README.md`](./standard/README.md).

The single most important rule of the project is also the first rule we apply to ourselves:

> **Evidence over confidence.** A claim in a decision, a default in a profile, or a budget number should be backed by a reason and (where possible) a source - not asserted because it feels right.

## Where to contribute

### 1. The standard (`standard/`)

Changes to schemas, templates, or the directory model affect everyone. They require:

- an **ADR** in `tech/decisions/` (use [`standard/templates/adr-template.md`](./standard/templates/adr-template.md)) describing the change, alternatives, and review triggers;
- a worked diff to at least one schema in `standard/schemas/` plus a matching template update;
- backward-compatibility notes (schemas are versioned).

### 2. Profiles (`standard/profiles/`)

New profiles (e.g. `mobile`, `infra`) or budget recalibration. Each default budget number must carry a short rationale comment. Open an issue first so we can align on the profile's identity.

### 3. The toolchain (`packages/`)

`core/` is pure ESM and must run in **both Node and the browser** (Phase 2 reuses it in the web wizard) - keep it free of Node-only APIs in modules that the browser will import. `cli/` is the thin Node wrapper.

- Run `npm install` then `npm test`.
- Run `npm run selfcheck` - it validates the bundled example capability and must stay green.

### 4. Adapters (root `AGENTS.md` / `CLAUDE.md` / `.cursor/` / …)

`AGENTS.md` is the **single source of truth**. Per-tool files must remain thin pointers - never duplicate rules into them, or they become a second, drifting source of truth.

## Pull request checklist

```
[ ] Change is scoped to one of the buckets above
[ ] If it touches the standard, an ADR is included
[ ] Schemas and templates stay in sync
[ ] `npm test` and `npm run selfcheck` pass
[ ] No rule duplicated across adapter files
[ ] New defaults/budgets carry a rationale
```

## Reporting issues

Use GitHub Issues. For proposals that change the standard, prefer a short design note (problem → evidence → proposed change → impact) over a code-first PR.

By contributing you agree your contributions are licensed under [Apache-2.0](./LICENSE).
