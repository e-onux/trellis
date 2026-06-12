// Assembles the static wizard site into apps/web/dist/.
// - copies the page assets,
// - copies the SHARED core compose.js (single source of truth) into dist/lib/,
// - generates skeleton.json from standard/repo-skeleton + standard/profiles (so the browser can build
//   the .zip starter and read profile defaults without any runtime dependency).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const standardDir = path.join(repoRoot, 'standard');
const dist = path.join(here, 'dist');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// 1) clean + dirs
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'lib'), { recursive: true });

// 2) page assets
for (const f of ['index.html', 'style.css', 'app.js']) {
  fs.copyFileSync(path.join(here, 'src', f), path.join(dist, f));
}
// 3) shared engine + zip lib
fs.copyFileSync(path.join(repoRoot, 'packages', 'core', 'src', 'compose.js'), path.join(dist, 'lib', 'compose.js'));
fs.copyFileSync(path.join(here, 'lib', 'zip.js'), path.join(dist, 'lib', 'zip.js'));

// 3b) brand assets (single source: docs/assets)
fs.copyFileSync(path.join(repoRoot, 'docs', 'assets', 'trellis-logo.svg'), path.join(dist, 'logo.svg'));
fs.copyFileSync(path.join(repoRoot, 'docs', 'assets', 'social-preview.png'), path.join(dist, 'social-preview.png'));

// 4) skeleton.json from repo-skeleton (exclude the generated config + noise)
const skelRoot = path.join(standardDir, 'repo-skeleton');
const skeleton = {};
for (const file of walk(skelRoot)) {
  const rel = path.relative(skelRoot, file).split(path.sep).join('/');
  if (rel === '.trellis.yaml') continue;     // the wizard generates this per selection
  if (rel.endsWith('.DS_Store')) continue;
  skeleton[rel] = fs.readFileSync(file, 'utf8');
}

// 5) profile defaults (parsed → JSON so the browser needs no YAML parser)
const profiles = {};
for (const f of fs.readdirSync(path.join(standardDir, 'profiles'))) {
  if (!f.endsWith('.yaml')) continue;
  profiles[f.replace(/\.yaml$/, '')] = YAML.parse(fs.readFileSync(path.join(standardDir, 'profiles', f), 'utf8'));
}

fs.writeFileSync(path.join(dist, 'skeleton.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  standard: '0.1',
  profiles,
  skeleton
}));

const skelCount = Object.keys(skeleton).length;
console.log(`✓ built apps/web/dist`);
console.log(`  page: index.html, style.css, app.js`);
console.log(`  lib:  compose.js (shared), zip.js`);
console.log(`  data: skeleton.json (${skelCount} skeleton files, ${Object.keys(profiles).length} profiles, ${(fs.statSync(path.join(dist,'skeleton.json')).size/1024).toFixed(1)} KB)`);
