# Capabilities

This repository's own engine behaviors, governed by its own standard. `trellis audit --root .`
runs against these in CI.

| Capability | Status | Owner | Contract |
|---|---|---|---|
| contract-validation | active | toolchain | [contract.yaml](./contract-validation/contract.yaml) |
| budget-check | active | toolchain | [contract.yaml](./budget-check/contract.yaml) |
| extension-completeness | active | toolchain | [contract.yaml](./extension-completeness/contract.yaml) |
| repo-audit | active | toolchain | [contract.yaml](./repo-audit/contract.yaml) |
| compose-artifacts | active | toolchain | [contract.yaml](./compose-artifacts/contract.yaml) |
| build-evidence-graph | active | toolchain | [contract.yaml](./build-evidence-graph/contract.yaml) |
| check-model-provenance | active | toolchain | [contract.yaml](./check-model-provenance/contract.yaml) |
| secret-scan | active | toolchain | [contract.yaml](./secret-scan/contract.yaml) |

Budgets measure the real implementation files under `packages/core/src/` via each contract's
`implementation:` list, including real import scanning.
