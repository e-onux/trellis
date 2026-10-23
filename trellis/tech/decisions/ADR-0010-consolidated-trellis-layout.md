# ADR-0010: Consolidate all governed artifacts under a single `trellis/` directory

```yaml
id: ADR-0010
title: Consolidate all governed artifacts under a single trellis/ directory
status: accepted
date: 2026-10-22

context:
  description: >
    Trellis scattered its governed artifacts across the repo root - governance/, product/, tech/,
    sources/, extensions/, capabilities/, quality/, lifecycle/, plus .trellis.yaml and TRELLIS.md - so
    adopting Trellis littered a project's root with governance files sitting beside application code.
    Core also hardcoded several of these locations (tech/decisions, sources/bibliography.yaml,
    governance/model-policy.yaml, .trellis/provenance.jsonl) even though .trellis.yaml already carried a
    paths map, so the layout was only half configurable. The requirement: all Trellis files live in one
    place, with only a minimal, agent-native footprint at the repo root, and the coding agent must load
    the rules reliably (the way an auto-loaded memory file is loaded).

decision:
  selected: >
    Nest every governed area under a single top-level `trellis/` directory and make the whole layout
    config-driven. `.trellis.yaml` becomes `trellis/trellis.yaml` and gains a `root:` key (default
    `trellis`); `paths:` name each area relative to that root. Core resolves every location through one
    helper (config.js `areaDir` / `provenancePath`), so nothing is hardcoded. The repo root keeps only
    the agent-native adapter files, because each tool auto-loads its own: AGENTS.md (canonical) plus thin
    pointers (CLAUDE.md, GEMINI.md, .github/copilot-instructions.md, .cursor/rules/, .windsurf/rules/).
    The CLAUDE.md pointer uses Claude Code's `@AGENTS.md` import so the rules load automatically, the way
    memory does, instead of depending on the agent to follow a link. The standard version moves to 0.2.

alternatives:
  - A hidden `.trellis/` directory (rejected - governance is meant to be read by humans; hiding the
    human-readable constitution, ADRs and contracts in a dotfolder works against that)
  - A single AGENTS.md at the root with no per-tool pointers (rejected - only tools that read AGENTS.md
    natively would auto-load the rules; Claude Code, Copilot, Cursor, Windsurf and Gemini would not, so
    the "agent respects the rules" guarantee would be lost for them)
  - Move the product source (standard/, packages/) under trellis/ too (rejected - that is shipped code
    consumed by the npm package and the external website per ADR-0003, not repo-governance clutter; it is
    precisely the code that governance should not crowd)
  - Keep the flat top-level layout (rejected - this is the problem being fixed)

assumptions:
  - Adopters want governance quarantined from code; a single visible directory is the clearest shape.
  - Every supported agent either reads AGENTS.md natively or has a thin pointer at the root, so the rules
    load for all of them.

consequences:
  positive:
    - A project adopting Trellis gets one `trellis/` directory plus a handful of tiny root pointers; no
      governance file sits beside the code.
    - The layout is fully configurable through `root` + `paths`; core hardcodes no governed location.
    - Claude Code loads the rules automatically via the `@AGENTS.md` import in CLAUDE.md.
  negative:
    - A one-time migration for existing adopters (move the dirs, add `root: trellis`).
    - The agent-native pointer files are an irreducible root footprint - one per enabled tool - because
      those filenames and locations are dictated by the tools, not by Trellis.

review:
  interval: 12 months
  next_review: 2027-10-22
  triggers:
    - a supported agent changes where it auto-loads instructions from
    - adopters report confusion between the repo being named trellis and the governed trellis/ directory
    - a need arises to relocate or rename the governed root (the `root` key already allows it)

affected_capabilities: []

migration:
  required: true
  description: >
    Existing repos keep working on the legacy top-level layout (core treats an absent `root` as the repo
    root). To adopt the consolidated layout: move the governed directories into `trellis/`, move
    `.trellis.yaml` to `trellis/trellis.yaml` and add `root: trellis`, and move `TRELLIS.md` (and any
    `.trellis/provenance.jsonl`) under `trellis/`. The root agent-adapter files stay where they are.

rollback:
  available: true
```

## Notes

This is a self-applied change: the Trellis monorepo and the worked example app (`e-onux/trellis-example-app`)
were both migrated to the new layout, and `trellis audit` stays green on each. Back-compatibility is covered
by a core test that audits a legacy top-level repo, so older adopters are not forced to migrate.
