# ADR-0001: Record architecture decisions

```yaml
id: ADR-0001
title: Record architecture decisions
status: accepted
date: 2026-06-10

context:
  description: >
    Trellis is developed largely with AI coding agents and asks its users to record decisions
    in-repo. The project must hold itself to the same rule: decisions made in chat sessions are
    lost between sessions, and the standard's own design rationale must outlive any one session.

decision:
  selected: Use Trellis ADRs (YAML front matter validated against the ADR schema) for every significant decision in this repository.

alternatives:
  - Keep decisions in chat history and PR descriptions only
  - Free-form design docs without machine-checkable fields

evidence: []

assumptions:
  - The project continues to be developed with AI assistance.
  - Contributors read ADRs before changing the standard.

consequences:
  positive:
    - Design rationale is queryable and survives sessions.
    - The repository demonstrates the standard it defines.
  negative:
    - Small overhead per decision.

review:
  interval: 12 months
  next_review: 2027-06-12
  triggers:
    - a better decision-record format is adopted project-wide

affected_capabilities: []

migration:
  required: false

rollback:
  available: true
```

## Notes

This mirrors the seed ADR that `trellis init` scaffolds for users, applied to Trellis itself.
