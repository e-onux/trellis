# Engineering Principles

Project-specific engineering rules. These are more detailed and faster-changing than the constitution.
Fill in with your project's conventions; the defaults below are a starting point.

## Boundaries

- Business rules live in capabilities, not in controllers/UI.
- A capability does not reach into another capability's internals - it depends on its contract.
- No circular dependencies between capabilities.

## Change discipline

- Smallest change that satisfies the contract.
- Evaluate the existing structure before adding a new abstraction or layer.
- Check the decision record before introducing a new dependency.

## Tests

- Tests describe behavior, not implementation details.
- Every capability keeps at least one normal and one error scenario in its contract.

## Documentation

- Minimum useful documentation - no decorative docs.
- Docs that drift from code are bugs.

_Add language/framework-specific conventions below._
