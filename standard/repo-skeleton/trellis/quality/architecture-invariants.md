# Architecture Invariants

Rules that must always hold. `trellis` drift checks compare the codebase against these. Express them concretely
enough to be checkable.

## Examples (replace with yours)

- The UI layer must not import from the infrastructure layer directly.
- A capability must not import another capability's internal modules (only its public contract).
- No circular dependencies between capabilities.
- Domain code must not depend on a specific framework.
- No capability owns more than its budgeted number of database tables.

## Forbidden dependencies

| From | To | Reason |
|---|---|---|
| ui | infrastructure | bypasses application/domain boundaries |
