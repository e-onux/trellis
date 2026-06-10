# {{ADR-XXXX}}: {{Short decision title}}

> Machine-readable front matter validated against standard/schemas/adr.schema.json.
> Decisions in Trellis are **conditional, not permanent** - every ADR carries assumptions and review triggers.

```yaml
id: ADR-XXXX
title: {{Short decision title}}
status: proposed            # proposed | accepted | experimental | deprecated | superseded | rejected | under-review
date: 2026-01-01

context:
  description: >
    What forces this decision? What problem or requirement?

decision:
  selected: {{the chosen option}}

alternatives:
  - option A
  - option B

evidence:
  - id: source-001
    type: benchmark

assumptions:                # the conditions under which this decision is valid
  - assumption that, if false, invalidates this decision

consequences:
  positive:
    - …
  negative:
    - …

review:
  interval: 12 months
  next_review: 2027-01-01
  triggers:                 # events that force early re-evaluation
    - major-version-release
    - security-advisory
    - performance-budget-exceeded

affected_capabilities:
  - capability-id

migration:
  required: false

rollback:
  available: false
```

## Notes

Free-form discussion, links, and reasoning that don't fit the structured fields above.
