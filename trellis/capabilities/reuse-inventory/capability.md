# Capability: reuse-inventory

A short, Git-tracked index of **costly, verified, reusable solutions** so an agent finds an existing hard
algorithm before re-writing it. Module `reuse_inventory` - on by default, `false` in `.trellis.yaml` turns
it off. Decision and measurements: [ADR-0008](../../tech/decisions/ADR-0008-reuse-inventory.md).

**Try it (human-verifiable surface):**

```bash
trellis inventory find "three-way merge"      # ≤ 3 candidates (max 5) + match reason + code/test paths
trellis inventory status                      # empty | jsonl | migration_pending | sqlite | conflict | disabled
trellis inventory validate                    # broken lines, duplicate ids, missing paths, unresolved links
```

| Operation | What it does |
|---|---|
| `find <query>` | Ranked, bounded candidates; the same shape for JSONL and SQLite. No match → "search the code area", never "no solution". |
| `add` / `update <id>` / `remove <id>` | Validated writes (schema, duplicates, code/test paths exist, capability/ADR resolve). |
| `validate` | Store-wide check; also the `reuse-inventory` audit gate (advisory). |
| `status` | Store state; only `migration_pending` carries the one-time user notice. |

Related: [migrate-reuse-inventory](../migrate-reuse-inventory/contract.yaml) (JSONL → SQLite, recover) and
[review-reuse-inventory](../review-reuse-inventory/contract.yaml) (record-level `diff` and `merge`).

**Limits:** matching is lexical over id, terms and purpose (with case/diacritic folding) - record good
synonyms in `terms`. The `#symbol` part of an entry is not checked, only the file path.
