# ADR-0004: Expose the evidence graph as data in core; keep the viewer a separate tool

```yaml
id: ADR-0004
title: Expose the evidence graph as data in core; keep the viewer a separate tool (Trelliscope)
status: accepted
date: 2026-06-15

context:
  description: >
    The evidence graph (Source -> Decision -> Capability) existed only as YAML id references that
    `trellis audit` validates - real but invisible. A viewer (a self-contained HTML app plus an
    Obsidian-compatible vault export) was first built inside this repository, but that puts
    application / UI code into the bare standard repo, against the ADR-0003 principle that this repo
    stays the standard + toolchain and nothing else. A renderer that "reads your repository" living
    inside the standard can also make users uneasy, even though it reads strictly less than the
    audit already does.

decision:
  selected: >
    Split the concern. `@sidrelabs/trellis-core` exposes the evidence graph as DATA - loadEvidenceGraph
    / buildEvidenceGraph, the build-evidence-graph capability - reading only the governance files
    (sources, ADRs, capability contracts), locally, with no network and no telemetry. Rendering and
    navigation (the HTML viewer, the Obsidian vault export, the CLI) live in a SEPARATE repository and
    npm package, Trelliscope (@sidrelabs/trelliscope), which depends on @sidrelabs/trellis-core. The
    standard repo stays bare; Trellis supports Obsidian without depending on it (Trelliscope writes the
    vault). The governed Markdown/YAML remains the single source of truth.

alternatives:
  - Keep the viewer inside this repo (rejected - app/UI in the bare standard, contradicts ADR-0003)
  - Use Obsidian itself as the viewer (rejected - proprietary GUI, not CI/agent-friendly, a dependency)
  - Duplicate the evidence-graph loader inside Trelliscope (rejected - it would drift from what `audit` validates)

assumptions:
  - The governed YAML/Markdown stays the source of truth; the graph is regenerable data.
  - The graph data API is local-only - no network, no telemetry - so it is no more sensitive than `audit`.
  - Trelliscope consumes @sidrelabs/trellis-core rather than re-reading the repo format itself.

consequences:
  positive:
    - The standard repository stays bare - it ships the graph as data, not an application.
    - One source of truth for the graph (reused by Trelliscope, CI, dashboards); it cannot drift from the audit.
    - The viewer can evolve as a product (its own releases) without touching the standard.
    - Obsidian is supported without Trellis depending on it.
  negative:
    - A cross-repo dependency from Trelliscope to @sidrelabs/trellis-core (a local path until core is published).
    - The graph data API has no in-repo consumer; only external tools use it.

review:
  interval: 12 months
  next_review: 2027-06-15
  triggers:
    - the toolchain itself needs to render the graph (reconsider co-locating a renderer)
    - the graph data API gains any network behaviour (it must stay local-only)
    - the Trelliscope and core graph shapes diverge

affected_capabilities:
  - build-evidence-graph

migration:
  required: false

rollback:
  available: true
```

## Notes

Trelliscope and any other consumer read one normalized graph from `build-evidence-graph`, so a viewer
can never disagree with what `trellis audit` validates. The data layer reads only the governance files
and never phones home - the trust boundary that matters is kept simple.
