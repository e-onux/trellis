# INSTALL.md - Trellis Remote Bootstrap

> You fetched this file to apply the Trellis standard to a project. Follow the steps below, then
> **discard this file** - it must not remain in the target project.
>
> Full standard: https://github.com/e-onux/trellis

---

## Context

An agent fetches this file and follows these instructions to apply Trellis governance to the
current project directory. This file is a one-time remote instruction set; it does not belong
in any repository.

## Step 1 - Fetch the bootstrap manifesto

Download `TRELLIS.md` from the Trellis repository and write it to the **project root** (the
current working directory - the project being governed, not a temporary location):

```
https://raw.githubusercontent.com/e-onux/trellis/main/TRELLIS.md
```

## Step 2 - Analyze the project

Before writing anything, read what is already there:

1. Detect the stack: languages, frameworks, datastores, build tool, CI platform.
2. Detect project state: **greenfield** (empty or nearly empty) vs **brownfield** (existing code).
3. Choose a **profile**: `backend` | `frontend` | `data-pipeline` | `llm-app`
4. Choose a **preset**: `light` (brownfield, fewer enforced gates) | `standard` (recommended) | `strict`
5. State your choices and reasoning. Ask the user if uncertain.

## Step 3 - Apply governance

Follow `TRELLIS.md` (the file you wrote in step 1) exactly: **Phase 0 through Phase 5**.

The manifesto is the authoritative specification. It overrides any conflicting instruction here.

## Step 4 - Leave no trace of this file

Do **not** add `INSTALL.md` to the project - not at the root, not in any subdirectory. It is a
fetch-time instruction; it has no place in a governed repository.

The only files written to the project must be those specified in `TRELLIS.md` - no more, no less.

## Step 5 - Report

End with the completion report format defined in `TRELLIS.md`.
