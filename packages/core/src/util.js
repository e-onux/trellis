// Filesystem + path helpers for the Trellis engine. Node-only module (the browser build of
// core uses an in-memory FS shim and never imports this file directly).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk upward from a starting directory until we find the Trellis `standard/` directory
 * (identified by the presence of `standard/repo-skeleton`). Works both inside this monorepo
 * and when `standard/` is bundled at a published package root.
 */
export function findStandardDir(start = HERE) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'standard');
    if (fs.existsSync(path.join(candidate, 'repo-skeleton'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate the Trellis standard/ directory. Pass { standardDir } explicitly.');
}

export const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.php', '.rb', '.go', '.rs',
  '.java', '.kt', '.kts', '.swift', '.cs', '.c', '.cc', '.cpp', '.h', '.hpp',
  '.scala', '.ex', '.exs', '.dart', '.vue', '.svelte', '.sql'
]);

export function isCodeFile(file) {
  return CODE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

/** Recursively list files under `dir`, skipping any path segment in `skipDirs`. */
export function walkFiles(dir, { skipDirs = [] } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const skip = new Set([...skipDirs, 'node_modules', '.git']);
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

/** Count non-blank, non-comment-only lines of code in a file (best-effort, language-agnostic). */
export function countLoc(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return 0;
  }
  let count = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(\/\/|#|\*|\/\*|\*\/|--)/.test(line)) continue; // common single-line comment markers
    count++;
  }
  return count;
}

/** Recursively copy a directory tree (files + dirs), creating parents as needed. */
export function copyTree(src, dest, { overwrite = false } = {}) {
  const copied = [];
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyTree(s, d, { overwrite }));
    } else {
      if (fs.existsSync(d) && !overwrite) continue;
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      copied.push(d);
    }
  }
  return copied;
}

export { fs, path };
