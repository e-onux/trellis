# Changelog

## Unreleased

- Model policy (ADR-0005): declare which models may author code in `governance/model-policy.yaml`;
  `trellis model-check` is a fail-closed gate (provenance recorded out-of-band in
  `.trellis/provenance.jsonl`, so commit messages stay clean) and `trellis model-stamp` records it -
  so a degraded fallback model cannot silently ship code.
- Security manifesto (ADR-0006): a profile-aware, evidence-backed `governance/security-manifesto.md`
  of what an agent must watch for, plus one enforced rule - `trellis secret-scan` (fail-closed,
  high-signal, never prints the secret). Deep SAST stays delegated to external tools (Semgrep, CodeQL).
- Evidence graph as data (ADR-0004): `@sidrelabs/trellis-core` now exposes the evidence graph via
  `loadEvidenceGraph` / `buildEvidenceGraph` (the build-evidence-graph capability) - reading only the
  governance files, locally, with no network. Rendering and navigation moved to a separate tool,
  [Trelliscope](https://github.com/e-onux/trelliscope) (`@sidrelabs/trelliscope`), which renders a
  self-contained HTML app or an Obsidian vault from that graph - so this repo stays the bare standard
  and Trellis supports Obsidian without depending on it.
- Rebrand: the npm scope moved to SidreLabs (`@sidrelabs/trellis`, `@sidrelabs/trellis-core`) and the
  category domain is now vibecodegovern.com. The GitHub repository (`e-onux/trellis`) is unchanged.
- The website (landing + wizard) moved to a separate workspace outside this repository; the repo
  stays the bare standard + toolchain (ADR-0003). The GitHub Pages backup deploy was retired;
  vibecodegovern.com remains the production host.

## 0.2.0 - 2026-06-12

- Honest gate reporting: a declared gate without a wired check is reported as "not evaluated" instead of silently passing
- Budget checks measure real JS/TS/Python imports instead of trusting declared dependencies
- Audit validates the evidence graph: ADR evidence ids, capability decision references and source `supports` targets must resolve
- npm packaging: the standard ships inside `@sidrelabs/trellis-core`, so `npx @sidrelabs/trellis` works outside the monorepo
- Schema `$id` fields point at this repository instead of an unowned domain
- Repo-skeleton references resolve in scaffolded projects (template links point at this repository)
- Trellis applies its own standard to this repository: capability contracts, ADRs, evidence and a CI self-audit
- Docs: comparison page, per-tool integration guides, roadmap

## 0.1.0 - 2026-06-10

- Initial release: the standard (schemas, templates, profiles, repo skeleton), TRELLIS.md bootstrap manifesto,
  multi-platform agent adapters with AGENTS.md as canonical, core engine and CLI
  (init / validate / budget-check / audit / extension / capability add), worked example, wizard site
