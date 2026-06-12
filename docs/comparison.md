# How Trellis relates to other tools

Trellis is **not a competitor to spec-driven development tools**. Spec-driven tools answer *what to build*.
Trellis is a governance and verification layer that preserves *why it was built that way, how much it is
allowed to grow, and how it is verified* - and it is designed to sit on top of the tools below, not replace
them. This page is honest about the overlaps.

If you have not read it yet, start with the [standard](../standard/README.md) and
[getting started](./getting-started.md).

## GitHub Spec Kit

[github.com/github/spec-kit](https://github.com/github/spec-kit) · ~93k stars as of mid-2026

**What it does well.** The most widely adopted spec-driven workflow: a `constitution` of project principles,
then `specify → plan → tasks` to drive an agent from intent to implementation. Works across 30+ agents and
has a large template ecosystem.

**What Trellis adds.** Spec Kit's constitution is a static document; Trellis gives decisions a lifecycle
(ADRs with assumptions, review intervals and re-evaluation triggers), links them to sources through the
evidence graph, enforces capability budgets in CI so the implementation cannot sprawl after the spec is
"done", and exposes a user-facing verification surface so non-engineers can check behavior.

**Can you use both?** Yes, and it is a natural pairing: use Spec Kit to produce the spec and task breakdown,
and Trellis to govern the resulting capabilities, record the decisions behind them, and gate growth.

## OpenSpec

[github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) · ~52k stars as of mid-2026

**What it does well.** A deliberately lightweight flow: each change lives in its own change folder with a
proposal, spec deltas and tasks. Low ceremony, easy to retrofit, agent-agnostic.

**What Trellis adds.** Budgets (a change can be spec-compliant and still push a capability past sane size),
evidence (why was this the right change?), and enforced quality gates in CI.

**Can you use both?** Yes. OpenSpec's change folders describe the delta; Trellis describes and verifies the
steady state the deltas accumulate into.

## BMAD-METHOD

[github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) · ~48k stars as of mid-2026

**What it does well.** A full multi-agent SDLC: analyst, PM, architect, developer and QA personas that hand
off structured documents to each other. Strong for greenfield projects that want process from day one.

**What Trellis adds.** An agent-independent repository standard *underneath* any persona workflow. BMAD
defines who does what; Trellis defines what the repository must contain and prove regardless of which
persona (or which vendor's agent) touched it last.

**Can you use both?** Yes. BMAD personas can write their outputs into Trellis artifacts (ADRs, capability
contracts, sources), and `trellis audit` checks the result without caring which persona produced it.

## AWS Kiro specs

[kiro.dev](https://kiro.dev)

**What it does well.** Spec-driven development built into an IDE: `requirements → design → tasks`, EARS
notation for requirements, and first-class property-based testing. Tight feedback loop between spec and code.

**What Trellis adds.** An open standard not tied to one IDE or vendor, capability budgets, and the evidence
graph. Kiro verifies that code matches the spec; Trellis also records why the spec is what it is and stops
the implementation from outgrowing its responsibility.

**Can you use both?** Yes. Kiro specs map well onto capability contracts, and Trellis's CI gates run
anywhere, including on repos developed in Kiro.

## Tessl

[tessl.io](https://tessl.io)

**What it does well.** The closest commercial neighbor: a spec registry plus framework where specs are
capabilities with tests attached, treated as the source of truth that code is generated from.

**What Trellis adds.** An open Apache-2.0 standard rather than a commercial platform, the governance and
decision layer (ADRs, evidence, review triggers), and anti-bloat budgets. The capability-with-tests idea is
shared; the surrounding governance is not. A Trellis capability contract could plausibly be exported as a
Tessl spec one day - the shapes are compatible.

**Can you use both?** In principle yes; today they are parallel ecosystems with a shared core idea.

## AGENTS.md

[agents.md](https://agents.md) · Linux Foundation stewarded, used in 60k+ repos as of mid-2026

**Not a competitor at all.** AGENTS.md is the instruction-file standard that tells agents how to behave in a
repo. Trellis treats it as **canonical**: `trellis init` generates one `AGENTS.md` carrying the rules and
thin per-tool pointer files (`CLAUDE.md`, `.cursor/rules/`, ...) that defer to it - see
[multi-platform support](../README.md#multi-platform-support) and this repo's own [`AGENTS.md`](../AGENTS.md).
AGENTS.md standardizes the instruction surface; Trellis standardizes what the instructions govern.

## ADR / MADR

**What they do well.** The classic, proven way to record architecture decisions as numbered markdown files.
MADR adds a clear template. Decades of collective practice; zero tooling required.

**What Trellis adds.** Trellis ADRs are classic ADRs plus machine-readable YAML front matter
([schema](../standard/schemas/adr.schema.json)): explicit assumptions, a review interval, re-evaluation
triggers, and links into the evidence graph (which sources back this decision, which capabilities depend on
it). A plain ADR records a decision; a Trellis ADR also knows when it should be questioned.

**Can you use both?** Existing ADRs migrate directly - add front matter and keep the body.

## Cucumber / Gherkin

Behavior specs as executable `Given/When/Then` scenarios, readable by non-engineers. Trellis generalizes the
same idea - visible, runnable behavior - from test scenarios to whole-system capabilities: every capability
has a contract, examples, and a surface where expected vs actual output can be compared by a human.

## Storybook

Isolated, browsable UI states that designers and PMs can inspect without running the app. Trellis's test
cockpit applies the same "make it visible to non-engineers" principle to system capabilities rather than UI
components; the `frontend` profile pairs naturally with Storybook.

## At a glance

| Tool | What to build | Why it was built | How much it may grow | How it is verified | Who can verify |
|---|---|---|---|---|---|
| Spec Kit | specify / plan / tasks | constitution (static) | - | task checklists | engineers |
| OpenSpec | change folders | change proposals | - | spec deltas | engineers |
| BMAD-METHOD | PRD + architecture personas | persona documents | - | QA persona | engineers |
| Kiro | requirements / design / tasks (EARS) | - | - | property-based tests | engineers, in the IDE |
| Tessl | capability specs | - | - | tests bound to specs | engineers |
| AGENTS.md | - (instructions, not specs) | - | - | - | - |
| ADR / MADR | - | decision records | - | - | - |
| Cucumber/Gherkin | feature scenarios | - | - | executable scenarios | partly non-engineers |
| Storybook | UI states | - | - | visual review | designers / PMs (UI only) |
| **Trellis** | capability contracts (or a spec tool on top) | ADRs + evidence graph, with review triggers | capability budgets, enforced in CI | quality gates in CI | non-engineers, via the test cockpit |

## The short version

Pick whichever spec-driven tool fits how your team works - that is the *what*. Add Trellis for the columns
the spec tools leave empty: *why* it was built (decision lifecycle + evidence), *how much* it may grow
(budgets), and *how* and *by whom* it is verified (gates + cockpit). The combination is the point.
