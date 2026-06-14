# ADR-0004: Ship an own evidence-graph viewer; support Obsidian, don't depend on it

```yaml
id: ADR-0004
title: Ship an own evidence-graph viewer; support Obsidian, don't depend on it
status: accepted
date: 2026-06-14

context:
  description: >
    The evidence graph (Source -> Decision -> Capability) existed only as YAML id references that
    `trellis audit` validates for integrity. It was real but invisible: nobody could see or navigate
    it, which is exactly the human-verifiable surface Phase 2 calls for. Obsidian renders any folder
    of Markdown with [[wikilinks]] as an interactive graph, and a Trellis repo is already Markdown +
    YAML - so it is tempting to lean on Obsidian as "the viewer". But Obsidian is a proprietary GUI
    app: it does not run in CI, is not agent-facing, and would contradict the open, agent-independent,
    deterministic-toolchain identity of the standard.

decision:
  selected: >
    Generate an own, dependency-free, self-contained HTML viewer from the evidence graph as the
    primary surface - one file, no CDN, no server, works offline in any repo. Additionally emit an
    Obsidian-compatible vault (one Markdown note per node with [[wikilinks]] plus a map-of-content
    index) so teams that already use Obsidian get its graph view for free. Both are generated
    artifacts; the governed YAML/Markdown stays the single source of truth. Trellis takes no runtime
    or build dependency on Obsidian or on any graph library.

alternatives:
  - Use Obsidian itself as the viewer (rejected - proprietary GUI, not CI/agent-friendly, a dependency)
  - Build a separate web app like the wizard (rejected - heavier, not embeddable per-repo, needs hosting)
  - Pull in d3 / cytoscape via CDN (rejected - breaks offline use and the zero-dependency core rule)

assumptions:
  - The standard's Markdown/YAML remains the source of truth; both outputs are regenerable views.
  - The viewer needs no server or network; a single HTML file is enough for the current graph sizes.
  - Obsidian stays an optional convenience, never a requirement to read the graph.

consequences:
  positive:
    - The evidence graph becomes navigable by non-engineers in any repo, with zero install.
    - Obsidian users get a richer, backlinked graph view at no extra cost.
    - Advances the Phase 2 human-verifiable surface without waiting on the full test cockpit.
  negative:
    - We now maintain a small amount of graph-layout code in the viewer.
    - The Obsidian vault is a generated view that goes stale if not regenerated after changes.

review:
  interval: 12 months
  next_review: 2027-06-14
  triggers:
    - a graph library becomes a justified dependency (revisit the hand-rolled layout)
    - the Phase 3 test cockpit subsumes the standalone viewer
    - Obsidian changes its wikilink or graph-view format

affected_capabilities:
  - build-evidence-graph
  - render-evidence-graph
  - export-obsidian-vault

migration:
  required: false

rollback:
  available: true
```

## Notes

The viewer and the Obsidian export read the same normalized graph from `build-evidence-graph`, so
the two surfaces can never disagree about what the evidence graph contains.
