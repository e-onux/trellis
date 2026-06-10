# apps/web - Trellis landing + wizard

A dependency-free static site. The wizard reuses **the same compose engine the CLI uses**
(`packages/core/src/compose.js`), so the generated AI spec / npx command / `.zip` starter always match
`trellis init`.

## How it works

- `src/index.html`, `src/style.css`, `src/app.js` - the page. `app.js` builds the form from the engine's
  metadata (`ALL_AGENTS`, `PROFILES`, `PRESETS`, `MODULES`) so the UI can't drift from the standard.
- `lib/zip.js` - a tiny, dependency-free ZIP writer (the browser builds the starter `.zip` locally).
- `build.mjs` - assembles `dist/`: copies the page + the shared `compose.js`, and generates
  `skeleton.json` from `standard/repo-skeleton` + `standard/profiles`.

## Build & preview

```bash
npm run build      # → apps/web/dist/
npm run serve      # build + serve dist/ at http://localhost:4321
```

## Deploy

`dist/` is fully static - host it anywhere. Live at **https://trellis.sidre.site** (nginx, via the Sidre
panel) with GitHub Pages as a backup. Nothing here needs a server runtime.
