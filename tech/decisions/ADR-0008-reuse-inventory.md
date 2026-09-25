# ADR-0008: Add a reuse inventory that migrates once from JSONL to a Git-tracked SQLite file

```yaml
id: ADR-0008
title: Add a reuse inventory that migrates once from JSONL to a Git-tracked SQLite file
status: accepted
date: 2026-09-25

context:
  description: >
    Coding agents regularly re-implement hard algorithms and large functions that already exist in the
    project, because nothing tells them the solution is there and a full-repo search is expensive and
    noisy. A small index of costly, verified, reusable solutions - searched before building - removes
    most of that waste. The index must stay cheap for agents (short, relevant answers, never the whole
    list), reviewable in Git, and must not require a model scan of the repo, a database service, network
    access or an embedding service. Trellis supports Node >= 18; `node:sqlite` only exists from Node 22.5.

decision:
  selected: >
    Add a `reuse_inventory` module, on by default and switchable off in `.trellis.yaml`. The inventory
    starts as `tech/reuse-index.jsonl` (one pointer record per line: id, purpose, terms, entry, tests,
    status, optional capability/ADR - schema `standard/schemas/reuse-inventory-record.schema.json`) and is
    filled incrementally with verified solutions via `trellis inventory add`; nothing scans the repo.
    `trellis inventory find` returns at most 5 (default 3) short candidates with match reasons and
    code/test paths in the same shape for every storage format, and an empty answer tells the agent to
    keep searching the code area. When the JSONL reaches 400 records or 128 KiB, the inventory migrates
    ONCE to `tech/reuse-index.sqlite`, which is Git-tracked and becomes the single persistent store: a
    temporary database is built and verified (schema version, count, ids, content, references,
    PRAGMA integrity_check), renamed into place, and only then is the JSONL deleted in the same change.
    The CLI will not start the migration until the agent has told the user a one-time notice in the
    conversation language (`status`/`add` report `migration_pending` with the notice; `migrate` refuses
    without `--notified`). Both files present is an explicit `conflict` that only `trellis inventory
    recover` resolves - automatically only when the two hold identical records. Because the database is
    binary, `trellis inventory diff` prints record-level changes and `trellis inventory merge <ref>` does
    a record-level three-way merge for parallel branches. SQLite is accessed through `node-sqlite3-wasm`
    (WASM, no native build, no transitive dependencies), loaded lazily only in the SQLite stage.

alternatives:
  - Keep JSONL forever (rejected - past a few hundred records the raw file is a ~30k-token hazard if an
    agent opens it, every write rewrites the whole file, and there is no indexed store to grow into)
  - SQLite from day one (rejected - small inventories review and merge best as line-oriented text, and
    most projects never need the driver)
  - SQLite as a Git-ignored cache rebuilt from JSONL (rejected - two stores drift; the requirement is one
    persistent source of truth)
  - Keep a text export next to the SQLite file for review (rejected - a second persistent copy; the
    record-level `diff` gives the same review without one)
  - better-sqlite3 (rejected - native build; v13 requires Node >= 22) / node:sqlite (rejected - Node >= 22.5
    only) / sql.js (rejected - 23 MB installed and whole-file export writes)
  - Embedding or vector search service (rejected - external service and network; lexical terms and
    synonyms chosen by the recording agent are enough for pointer records)
  - Seed the inventory by having a model scan the repo at install (rejected - costly, unverified, and
    it would list what exists rather than what is worth reusing)

assumptions:
  - Records average roughly 300 bytes; the byte bound (128 KiB) catches unusually verbose records first.
  - Agents follow the canonical AGENTS.md rule to search before building and to open code + tests
    instead of trusting a record.
  - A per-process WASM start of about 0.2 s is acceptable for a command run a few times per task.
  - The same Git repository hosts both the JSONL history and the SQLite file, so `diff` can compare
    across the migration.

consequences:
  positive:
    - Agents find existing costly solutions with a ~300-token answer instead of reading an index or the repo.
    - One persistent store at any time; the migration is verified, re-runnable and never silently resolved.
    - Works on Node 18+ on every platform with no native build, service, or network.
    - Reviewers see record-level diffs and parallel branches merge at record level despite the binary file.
  negative:
    - Adds a 1.3 MB (546 kB packed) dependency to core, loaded only once a repo migrates.
    - Each SQLite-stage CLI call pays ~0.18 s of WASM start-up; JSONL is faster per process at every size
      we measured, so the switch is justified by context risk and write scaling, not by speed.
    - Git sees a binary file after migration; conflicts need `trellis inventory merge` instead of a text merge.
    - The `reuse-inventory` audit gate is advisory until adopters have run it on real inventories.

review:
  interval: 12 months
  next_review: 2027-09-25
  triggers:
    - Node 22.5+ becomes the minimum supported version (switch the driver to node:sqlite)
    - adopters report the threshold too early/late on real inventories (re-run the benchmark)
    - the reuse-inventory gate is proposed for enforcement
    - SQLite schema version 2 is needed (add an in-place schema upgrade)

evidence:
  - id: source-0005
  - id: source-0006

affected_capabilities:
  - reuse-inventory
  - migrate-reuse-inventory
  - review-reuse-inventory
  - repo-audit
  - compose-artifacts

migration:
  required: false

rollback:
  available: true
```

## Threshold measurement

Measured with `node packages/core/bench/inventory-threshold.js` (synthetic records of ~300 bytes,
query `levenshtein fuzzy match`, median of 15 in-process runs; Node 23.11, darwin-x64):

| records | JSONL KiB | whole-file tokens (≈bytes/4) | find ms JSONL | find ms SQLite | SQLite KiB | find answer tokens |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 14.7 | 3,771 | 1.48 | 1.89 | 32 | 286 |
| 100 | 29.5 | 7,542 | 1.39 | 1.87 | 52 | 291 |
| 200 | 59.3 | 15,170 | 1.41 | 2.77 | 96 | 293 |
| **400** | **118.8** | **30,414** | **2.44** | **2.27** | **180** | **293** |
| 800 | 237.9 | 60,914 | 3.99 | 3.65 | 344 | 293 |
| 1600 | 477.9 | 122,347 | 7.49 | 6.27 | 676 | 296 |
| 3200 | 959.1 | 245,530 | 14.77 | 11.15 | 1,328 | 296 |

Cold, per CLI process (10 runs, 400 records): `trellis version` 120 ms, `inventory find` on JSONL 136 ms,
on SQLite 304 ms - the ~180 ms difference is WASM compilation. On Node 18.20.8 the driver opens and
queries a new database in ~194 ms.

Why **400 records or 128 KiB**:

1. **Context risk.** At 400 records the raw JSONL is ~30k tokens - about 100× a bounded `find` answer
   (~290 tokens, flat at every size). Past this point, an agent opening the file by mistake is the
   dominant cost; the SQLite file cannot be read that way, and `find` is the only way in.
2. **Scaling.** In-process query cost crosses over at ~400 records and SQLite grows more slowly after
   that (11 ms vs 15 ms at 3,200); JSONL writes rewrite the whole file while SQLite writes one row.
3. **Review.** Below the bound, one-line-per-record JSONL is the easiest format to review and merge in
   Git, so migrating earlier would give up the better review story for no gain.
4. **128 KiB** is the same ~32k-token budget expressed in bytes, so verbose records trigger it first.

SQLite does not by itself save tokens. The saving comes from `find` returning only a few short, relevant
records - which is also true while the inventory is JSONL.

## Merge conflicts on parallel branches

Git cannot merge the binary database. When two branches both changed `tech/reuse-index.sqlite`:

1. Keep your side in the working tree: `git checkout --ours tech/reuse-index.sqlite`.
2. Apply the other branch at record level: `trellis inventory merge <their-branch>` (use `--dry-run` to
   preview). Records changed on only one side are taken from that side; same-id records changed
   differently on both sides are listed as conflicts, nothing is written, and the command exits 2.
3. Settle conflicts with `--prefer ours|theirs`, or edit one side with `trellis inventory update` and
   re-run.
4. `trellis inventory validate`, then `git add tech/reuse-index.sqlite` and continue the merge.

If one branch migrated while the other still added JSONL lines, Git reports a modify/delete conflict and
leaves both files - Trellis then reports `conflict` and refuses to guess. Keep the SQLite side
(`git rm tech/reuse-index.jsonl`) and run step 2: `merge` reads each ref in its own format, so the other
branch's new JSONL records are applied to the SQLite store.
