# Roadmap

Where Trellis is going. Dates are intent, not promises; the standard's own rule applies here too:
decisions are conditional and reviewed.

## Shipped

- **0.1** - the standard (schemas, templates, profiles, repo skeleton), TRELLIS.md bootstrap,
  multi-platform adapters (AGENTS.md canonical), core engine + CLI, worked example, wizard site.
- **0.2** - honest gate reporting (not-evaluated is visible), real import scanning for budgets,
  evidence-graph reference validation, npm packaging with the bundled standard, self-hosted
  governance with CI self-audit, comparison and integration docs.

## Next (0.3)

- `trellis decision add` and `trellis source add` scaffolding commands
- Wire the `test` gate: run a per-capability `verification.command` and fail the gate on red
- Brownfield discovery: `trellis discover` proposes capability candidates from an existing codebase
- Windows runner in CI

## Later (0.4+)

- **Test cockpit MVP**: the user-facing surface where non-developers run a capability's examples
  and compare expected vs actual output
- Architecture drift detection (wire the `drift` gate to `quality/architecture-invariants.md`)
- Capability health score (tests + budgets + evidence freshness + drift in one number)
- Monorepo profile and nested `.trellis.yaml` support
- Import scanning for more languages (Go, Rust, Java, PHP)

## Out of scope (non-goals)

- Another coding agent or IDE
- A prompt library
- Replacing AGENTS.md or any spec-driven tool: Trellis layers on top of them

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Standard changes need an ADR; good first issues are
labeled on GitHub.
