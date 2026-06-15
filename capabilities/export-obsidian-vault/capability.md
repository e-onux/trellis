# Capability: export-obsidian-vault

Renders the evidence graph (`{ nodes, edges, dangling, stats }` from
[build-evidence-graph](../build-evidence-graph/capability.md)) into an Obsidian vault - a flat list
of `{ path, content }` Markdown notes - without ever touching disk.

- **Per-node notes** land under `sources/`, `decisions/`, or `capabilities/` by node type. Each note
  carries YAML frontmatter (`type`, `id`, `title`, optional `status`/`url`, and `trellis/<type>`
  tags), an `# <title>` heading, and - for sources - the `claim` as a blockquote plus a link to the
  `url`.
- **Links read from both ends.** Outgoing edges (the "is justified by" direction) are grouped as
  Obsidian wikilinks under `## Cites` and `## Governed by`; incoming edges are back-linked under
  `## Referenced by`. Empty sections are omitted.
- **`_evidence-graph.md`** is the map-of-content: a `trellis/moc` note with a one-line stats summary
  and wikilinks to every node grouped by type. **Dangling references** are listed there as plain
  text, never as wikilinks, because they do not resolve.

`renderObsidianVault` is pure and browser-safe (no Node APIs, no imports) and deterministic: the
returned array is sorted by path, so the same graph always produces byte-identical output. It is one
of two renderers - alongside the HTML viewer (`render-evidence-graph`) - that consume the single
graph shape, so the surfaces can never disagree.

See [ADR-0004](../../tech/decisions/ADR-0004-evidence-graph-visualization.md).
