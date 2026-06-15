# Capability: render-evidence-graph

Renders the evidence graph from [build-evidence-graph](../build-evidence-graph/capability.md) as a
single self-contained HTML file - inline CSS, vanilla JS, and the graph embedded as JSON. No server,
no CDN, no graph library (see [ADR-0004](../../tech/decisions/ADR-0004-evidence-graph-visualization.md)),
so it opens offline in any browser.

Layout: sources, decisions and capabilities are placed in three columns; edges point in the
"is justified by" direction with a dashed style for `governed-by`. Interactions are client-side:

- hover a node to highlight it and its links and dim the rest,
- click a node to inspect it (type, status, claim, source url, and its grouped links) in the side panel,
- toggle node types from the legend, and filter nodes by text.

`renderGraphHtml(graph, opts)` is pure and browser-safe; the CLI (`trellis graph`) loads the repo,
builds the graph, and writes the document to disk.
