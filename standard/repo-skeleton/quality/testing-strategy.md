# Testing Strategy

Trellis derives tests from contracts. Test types:

- **Unit** - internal logic of a capability.
- **Contract** - the declared input/output contract holds.
- **Property-based** - invariants hold across the input space (e.g. "price never negative").
- **Regression** - previously-passing scenarios still pass.
- **Integration** - interaction with other capabilities/services.
- **Visual** - rendered output matches expectation (frontend).
- **Security** - authz, input validation, data access.
- **Performance** - latency/throughput/memory budgets.
- **User validation** - a human confirms the output is correct *for the business* (cockpit).

Which are mandatory is set by your profile (`standard/profiles/<profile>.yaml`) and recorded per capability in
`contract.yaml → verification`.
