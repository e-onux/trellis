# ADR-0003: Keep the framework repository bare; maintain the website separately

```yaml
id: ADR-0003
title: Keep the framework repository bare; maintain the website separately
status: accepted
date: 2026-06-13

context:
  description: >
    The repository originally carried the standard, the toolchain and the marketing website
    (apps/web) as one monorepo. The website is a distribution artifact, not part of the standard:
    it changes on a marketing cadence, needs no review by standard contributors, and its CI
    (GitHub Pages) added a deploy pipeline unrelated to the toolchain's quality gates.

decision:
  selected: This repository contains only the standard and the toolchain. The website lives in a separate workspace that builds from a checkout of this repository (sibling directory or TRELLIS_FRAMEWORK env), reusing packages/core/src/compose.js and standard/ as its single source of truth.

alternatives:
  - Keep the monorepo with apps/web inside
  - Publish the website from a second public repository

assumptions:
  - The website keeps consuming compose.js and standard/ read-only; it contributes nothing back.
  - The production host (vibecodegovern.com) is deployed from the website workspace, not from CI here.

consequences:
  positive:
    - Contributors to the standard never touch marketing code; CI runs only quality gates.
    - The website can change copy and design freely without commits to the standard's history.
    - The single-source-of-truth rule survives, the wizard still imports the real compose engine.
  negative:
    - The GitHub Pages backup host is retired; the site has a single host until a site repo exists.
    - Website builds require a framework checkout next to the workspace.

review:
  interval: 12 months
  next_review: 2027-06-13
  triggers:
    - the website needs CI/CD of its own (consider a dedicated repository then)
    - compose.js or standard/ start needing website-driven changes

affected_capabilities:
  - compose-artifacts

migration:
  required: false

rollback:
  available: true
```

## Notes

The website workspace keeps its own git history. Restoring the monorepo layout is a single move of
the workspace back into the repository plus reverting this ADR to `superseded`.
