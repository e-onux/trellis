# Obsidian - view the evidence graph

Trellis records an **evidence graph** in your repository: every capability links to the decisions
(ADRs) that govern it and the sources that justify them. `trellis audit` checks that graph for
integrity, but you can also *look at* it - either in a self-contained HTML viewer or as an
[Obsidian](https://obsidian.md) vault.

Trellis **supports Obsidian without depending on it** ([ADR-0004](../../tech/decisions/ADR-0004-evidence-graph-visualization.md)):
the governed Markdown/YAML stays the single source of truth, and both surfaces are generated from the
same graph - so they can never disagree.

## Two ways to see the graph

```bash
trellis graph                     # → trellis-graph.html (open in any browser; no server, no network)
trellis graph --format obsidian   # → ./evidence-vault/ (open as an Obsidian vault)
trellis graph --format json       # → the raw { nodes, edges, dangling } graph on stdout
```

Both read the same graph the audit validates. `--out <path>` changes the output location; `--root <dir>`
points at another repository.

## Opening the vault in Obsidian

```bash
trellis graph --format obsidian --out evidence-vault
```

This writes one Markdown note per node:

```
evidence-vault/
├── _evidence-graph.md          ← map-of-content: every node, grouped, plus any dangling references
├── sources/        source-0001.md …
├── decisions/      ADR-0001.md …
└── capabilities/   repo-audit.md …
```

Then in Obsidian: **Open folder as vault** → select `evidence-vault/`. Open the **graph view** (the
graph icon in the left ribbon) and you will see the evidence graph - sources, decisions and
capabilities as nodes, the citations and governance links as edges.

Each note carries:

- frontmatter (`type`, `id`, `title`, `status`, `tags: [trellis/<type>]`),
- the source's claim and URL (for `source` notes),
- `## Cites` / `## Governed by` sections linking outward with `[[wikilinks]]`, and
- a `## Referenced by` section, so the provenance reads from both ends.

Because the links are real `[[wikilinks]]`, Obsidian's graph view, backlinks panel and local-graph all
work with no plugins.

### Pointing Obsidian at the repo directly (optional)

If you would rather not keep a generated folder, you can open the repository itself as a vault and
Obsidian will still render the notes you generate into it. Keep the vault folder out of the parts of
the repo you don't want indexed (or generate into a dedicated directory as above) - the generated
vault is a *view*, not the source of truth.

## Keeping it fresh

The vault and the HTML viewer are **generated artifacts**. Re-run `trellis graph …` after you add or
change sources, ADRs or capabilities. A natural place to wire this is alongside `trellis audit` in CI
or a pre-commit hook, publishing `trellis-graph.html` as a build artifact.

## What it does not do

- It does not require Obsidian - the HTML viewer needs nothing but a browser.
- It does not edit your governed files - it only reads them and writes the chosen output.
- It does not invent links - a reference that resolves to nothing is reported as **dangling** in the
  map-of-content (and fails the audit's `evidence` gate), never drawn as a real edge.

See also: [Getting started](../getting-started.md) · [How Trellis relates to other tools](../comparison.md).
