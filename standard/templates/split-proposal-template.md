# Split Proposal: {{capability}}

> Produced when new behavior does NOT fit a capability's `does` (or hits its `does_not`), or the capability
> is over budget. The agent proposes the split instead of silently growing the capability.

## Trigger

- [ ] New behavior conflicts with `does_not`
- [ ] New behavior introduces a new domain concept
- [ ] New behavior needs a new external dependency
- [ ] Capability budget would be exceeded

## Current responsibility

```
does:      ...
does_not:  ...
```

## Proposed capabilities

| New capability | Responsibility | Inputs → outputs (summary) |
|---|---|---|
| `...` | ... | ... |
| `...` | ... | ... |

## Shared dependencies

What both new capabilities need; how to avoid duplicating it.

## Impact

- Affected ADRs: ...
- Affected capabilities: ...
- Public API / migration: ...
