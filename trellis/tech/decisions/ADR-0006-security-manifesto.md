# ADR-0006: Add a security manifesto and an enforceable secret-scan gate

```yaml
id: ADR-0006
title: Add a security manifesto and an enforceable secret-scan gate
status: accepted
date: 2026-06-18

context:
  description: >
    Trellis claims AI-generated code carries materially more security defects, but never made
    security a governed axis. All that existed was a thin six-line quality/security-policy.md stub
    plus a recommended_verification flag in two profiles - not profile-aware, not evidence-backed,
    not enforced, and not dogfooded by this repository. Security was advice nobody could check.

decision:
  selected: >
    Make security a first-class, governed concern in two layers. A governance/security-manifesto.md
    states what an agent must keep in mind - profile-aware (backend, frontend, data-pipeline,
    llm-app) and grounded in OWASP Top 10, OWASP Top 10 for LLM Applications and CISA Secure by
    Design - and is surfaced as an advisory rule in AGENTS.md. Paired with it is exactly one
    mechanically enforced slice: secret-scan, a fail-closed gate (capability + trellis secret-scan)
    that detects committed credentials, keys and tokens. The manifesto supersedes the old stub,
    which becomes a pointer.

alternatives:
  - Reimplement deep vulnerability detection (SAST) inside core (rejected - noisy, false-positive
    heavy, and scope creep; Trellis is a governance layer, not a scanner)
  - Ship the manifesto as advice only, with no enforced check (rejected as the whole answer -
    advisory text does not enforce; the same lesson as ADR-0005, so pair it with one hard rule)
  - Wire security as a toggleable wizard module now (deferred - it touches compose/profiles/scaffold;
    ship the manifesto and the gate first, make it an optional module later)
  - Delete the security stub and rely on external tooling (rejected - loses the repo-resident,
    cross-session security memory that is the point)

assumptions:
  - Secret-scan is kept high-signal and low false-positive (specific provider patterns and private
    keys, a guarded generic rule) and honors an inline allowlist marker for fixtures and examples.
  - The manifesto is advisory; deep SAST stays external (Semgrep, CodeQL) via a future adapter.
  - Surfacing the manifesto in adopters generated AGENTS.md is the optional-module step, not this one.

consequences:
  positive:
    - Security is now repo-resident and survives across agent sessions (repository is the memory).
    - One security rule is actually enforced (no committed secrets), fail-closed, before merge.
    - The manifesto is evidence-backed, closing the gap between the README claim and the toolchain.
  negative:
    - The manifesto is advisory; it raises the floor but does not prove safety.
    - secret-scan runs as its own command and is not wired into trellis audit (which stays lean).
    - Adopters get the manifesto file, but their generated AGENTS.md will not reference it until
      the optional security module lands.

review:
  interval: 12 months
  next_review: 2027-06-18
  triggers:
    - a SAST adapter (Semgrep / CodeQL) lands - reconsider what stays advisory
    - the secret-scan false-positive rate climbs - tune the rules or add an allowlist file
    - the optional security module lands - wire the manifesto into the composed AGENTS.md

affected_capabilities:
  - secret-scan

evidence:
  - id: source-0002
  - id: source-0003
  - id: source-0004

migration:
  required: false

rollback:
  available: true
```

## Notes

Honest boundary, in one line: the manifesto changes behavior, secret-scan enforces the one rule that
can be enforced cleanly, and everything deeper is delegated to real security tooling rather than
re-invented inside Trellis.
