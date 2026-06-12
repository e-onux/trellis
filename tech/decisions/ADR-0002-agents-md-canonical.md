# ADR-0002: AGENTS.md is the canonical agent instruction surface

```yaml
id: ADR-0002
title: AGENTS.md is the canonical agent instruction surface
status: accepted
date: 2026-06-10

context:
  description: >
    Every coding tool has its own instruction file format (CLAUDE.md, .cursor/rules,
    .github/copilot-instructions.md, .windsurf/rules, GEMINI.md). Duplicating rules across
    them creates drifting sources of truth. Trellis needs one canonical surface and a way
    to reach every tool from it.

decision:
  selected: Treat AGENTS.md as canonical and generate thin per-tool pointer files that reference it; never duplicate rules into pointers.

alternatives:
  - Maintain full rule files per tool
  - Invent a new Trellis-specific instruction format

evidence:
  - id: source-0001
    type: official-documentation

assumptions:
  - AGENTS.md adoption keeps growing across agent tools.
  - Tools that do not read AGENTS.md natively keep supporting a per-tool pointer file.

consequences:
  positive:
    - Single source of truth; pointer files cannot drift because they carry no rules.
    - Trellis rides an existing standard instead of inventing a competing one.
  negative:
    - Tools that read only their own file get one indirection hop.

review:
  interval: 12 months
  next_review: 2027-06-12
  triggers:
    - AGENTS.md stewardship or adoption changes materially
    - a major tool drops support for repository instruction files

affected_capabilities:
  - compose-artifacts

migration:
  required: false

rollback:
  available: true
```

## Notes

The adapter file map lives in `packages/core/src/compose.js` (`AGENT_FILES`); codex, jules, aider
and zed read AGENTS.md natively, so no pointer file is generated for them.
