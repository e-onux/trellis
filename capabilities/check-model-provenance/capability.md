# Capability: check-model-provenance

Governs **which models may author code**. It joins the commits in the enforcement window with the
provenance recorded out-of-band in `.trellis/provenance.jsonl` and classifies each one against
[`governance/model-policy.yaml`](../../governance/model-policy.yaml).

- **allowed** - the recorded model is on the allow-list.
- **disallowed** - the recorded model is block-listed, or not on the allow-list.
- **unverified** - no provenance recorded and `require_provenance: true` (fail-closed → violation).
- **exempt** - no provenance recorded but provenance is not required.

`checkModelProvenance` and the pure `classifyCommits` live in
[`packages/core/src/model-policy.js`](../../packages/core/src/model-policy.js); the CLI surfaces
them as `trellis model-check` (fail-closed; non-zero exit blocks a merge) and `trellis model-stamp`
(records provenance for a commit). Reads only local files and `git log` - no network.

The trust boundary is deliberately honest (see
[ADR-0005](../../tech/decisions/ADR-0005-model-provenance-gate.md)): an advisory prompt in
`AGENTS.md` stops a cooperative agent, the provenance log is an **attestation** (not cryptographic
proof), and the fail-closed gate blocks anything unverified or disallowed **before merge**.
Reverting already-landed code is intentionally not automatic.
