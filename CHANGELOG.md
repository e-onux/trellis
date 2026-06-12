# Changelog

## 0.2.0 - 2026-06-12

- Honest gate reporting: a declared gate without a wired check is reported as "not evaluated" instead of silently passing
- Budget checks measure real JS/TS/Python imports instead of trusting declared dependencies
- Audit validates the evidence graph: ADR evidence ids, capability decision references and source `supports` targets must resolve
- npm packaging: the standard ships inside `@e-onux/trellis-core`, so `npx @e-onux/trellis` works outside the monorepo
- Schema `$id` fields point at this repository instead of an unowned domain
- Repo-skeleton references resolve in scaffolded projects (template links point at this repository)
- Trellis applies its own standard to this repository: capability contracts, ADRs, evidence and a CI self-audit
- Docs: comparison page, per-tool integration guides, roadmap

## 0.1.0 - 2026-06-10

- Initial release: the standard (schemas, templates, profiles, repo skeleton), TRELLIS.md bootstrap manifesto,
  multi-platform agent adapters with AGENTS.md as canonical, core engine and CLI
  (init / validate / budget-check / audit / extension / capability add), worked example, wizard site
