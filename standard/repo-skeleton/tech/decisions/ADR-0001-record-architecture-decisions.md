# ADR-0001: Record architecture decisions

> Seed ADR. Keep it - it documents *why this project records decisions at all*, and serves as a worked example.

```yaml
id: ADR-0001
title: Record architecture decisions
status: accepted
date: 2026-01-01

context:
  description: >
    This project is developed with AI coding agents. Decisions made in chat are lost between sessions,
    and code outlives the reasoning behind it. We need decisions to live in the repository, as conditional
    and reviewable records rather than tribal knowledge.

decision:
  selected: Use Trellis ADRs (YAML front matter validated against the ADR schema) for every significant decision.

alternatives:
  - Keep decisions in chat history / PR descriptions only
  - Free-form wiki pages
  - Classic markdown-only ADRs without machine-checkable fields

evidence:
  - id: source-0001
    type: official-documentation

assumptions:
  - The team values long-term maintainability over short-term speed.
  - Agents will read ADRs as context before making related changes.

consequences:
  positive:
    - Decisions, assumptions and review triggers are explicit and queryable.
    - Superseded decisions remain visible (history is preserved).
  negative:
    - Small overhead per decision.

review:
  interval: 12 months
  next_review: 2027-01-01
  triggers:
    - the team abandons agent-assisted development
    - a better decision-record format is adopted project-wide

affected_capabilities: []

migration:
  required: false

rollback:
  available: true
```

## Notes

This is ADR-0001 by convention. Copy `https://github.com/e-onux/trellis/blob/main/standard/templates/adr-template.md` for new decisions and increment the number.
