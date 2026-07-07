# Why AI-generated code needs governance, not just specs

AI now writes a large and growing share of production code. Generating it is easy; keeping it
maintainable is not. The gap that governance fills is real and, increasingly, measured.

## What the evidence shows

- **Volume is up, and so is churn.** Independent analysis of large commit corpora by
  [GitClear](https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality)
  found that as AI assistance spread, duplicated ("copy-pasted") code rose while refactoring
  ("moved" code) fell - the signature of code added faster than it is consolidated.
- **AI assistance can reduce security while raising confidence.** A Stanford study,
  [Do Users Write More Insecure Code with AI Assistants?](https://arxiv.org/abs/2211.03622)
  (Perry et al., ACM CCS 2023), found participants with an AI assistant wrote *less* secure code yet
  were *more* confident it was secure - the over-trust that governance exists to catch.
- **LLM-specific risks are now catalogued.** The
  [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) names prompt injection,
  sensitive-information disclosure and excessive agency as first-class risks - exactly the classes a
  security floor should force an agent to consider.

None of this says "do not use AI." It says the faster code is generated, the more it needs a layer
that keeps it bounded, explained, and verified.

## What spec-driven tools cover, and what they leave

Spec-driven tools (Spec Kit, OpenSpec, Kiro, Tessl, BMAD) answer **what to build**, and answer it
well. They largely do not answer:

- **Why** was it built this way, and when should that be reconsidered? Decisions rot silently.
- **How much** may a capability grow before it is really two? Specs are silent on size.
- **How, and by whom,** is it verified beyond "tests pass"? Non-engineers cannot see behavior.
- **Which model** wrote it - and was it one you trust? A degraded fallback ships quietly.
- **What security floor** must hold regardless of the feature? Secrets, injection, access.

## What Trellis does about it

| The gap | Trellis mechanism |
|---|---|
| Decisions lost in chat | ADRs with assumptions + review triggers, linked to an evidence graph |
| Silent sprawl | Capability budgets (files, LOC, deps, responsibilities), enforced in CI |
| "Tests pass" is opaque | A user-facing test cockpit: expected vs actual, per capability |
| Unknown authorship | Model policy: `trellis model-check` blocks a disallowed or unverified model |
| No security floor | Security manifesto + `trellis secret-scan` (no committed secrets), OWASP/CISA-grounded |

Governance is the layer that turns "the AI wrote it" into "the repository can prove it stays
maintainable." Pick any spec tool for the *what*; add Trellis for the rest.

See also: [How Trellis relates to other tools](./comparison.md) and [the standard](../standard/README.md).
