# Capability: build-evidence-graph

Normalizes the governed artifacts of a repository - `sources/bibliography.yaml`, the ADRs under
`tech/decisions/`, and the capability `contract.yaml` files - into one `{ nodes, edges, dangling }`
graph.

- **Nodes** are typed `source` | `decision` | `capability`.
- **Edges** point in the "is justified by" direction: a capability -> the decisions that govern it
  and the sources it cites; a decision -> the sources it cites. A source's `supports` list folds
  into the same edges and is deduplicated, so the link can be declared from either end.
- **Dangling** collects references whose target is not a node (the audit's `evidence` gate is what
  fails the build on these; this capability only surfaces them).

The shaping (`buildEvidenceGraph`) is pure and browser-safe; the loader (`loadEvidenceGraph`) reads
the repository from disk. This is the **data layer only** - rendering and navigation live in a
separate tool ([Trelliscope](https://github.com/e-onux/trelliscope), `@sidrelabs/trelliscope`),
which consumes this graph through `@sidrelabs/trellis-core`. Keeping the graph here as data means the
viewer can never disagree with what `trellis audit` validates.

See [ADR-0004](../../tech/decisions/ADR-0004-evidence-graph-visualization.md).
