# Refactor Proposal: {{capability or module}}

> Produced when a capability exceeds its budgets or accumulates drift. Per the constitution, the agent
> must produce this **before** writing more code into an over-budget capability.

## Problem

What boundary or budget is being exceeded?

## Evidence

- direct dependencies: N (budget M)
- distinct change reasons: N
- regressions in last 10 changes: N
- domains touched: ...

## Proposed split / restructure

- new-capability-a - responsibility
- new-capability-b - responsibility

## Risks

- API change, migration need, temporary duplication, ...

## Test plan

- existing contract tests preserved
- new contract per extracted capability
- compatibility test for old entry point

## Migration & rollback

Link to a migration plan (standard/templates/migration-template.md) if data or public API changes.
