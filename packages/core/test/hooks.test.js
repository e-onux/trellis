// Git hook installer tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installHooks, HOOKS } from '../src/index.js';

function tmpGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-hooks-'));
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true }); // installHooks only needs .git to exist
  return dir;
}

test('installHooks writes both hooks, executable, with the expected commands', () => {
  const repo = tmpGitRepo();
  const res = installHooks(repo);
  assert.deepEqual(res.installed.sort(), ['post-commit', 'pre-push']);
  assert.equal(res.skipped.length, 0);

  const post = path.join(repo, '.git', 'hooks', 'post-commit');
  const pre = path.join(repo, '.git', 'hooks', 'pre-push');
  assert.ok(fs.existsSync(post) && fs.existsSync(pre));
  assert.ok(fs.statSync(post).mode & 0o111, 'post-commit is executable');
  assert.match(fs.readFileSync(post, 'utf8'), /model-stamp --commit HEAD --model "\$TRELLIS_MODEL"/);
  assert.match(fs.readFileSync(pre, 'utf8'), /model-check/);
});

test('--only installs a single hook', () => {
  const repo = tmpGitRepo();
  const res = installHooks(repo, { only: 'post-commit' });
  assert.deepEqual(res.installed, ['post-commit']);
  assert.ok(!fs.existsSync(path.join(repo, '.git', 'hooks', 'pre-push')));
});

test('re-installing a Trellis-managed hook is idempotent', () => {
  const repo = tmpGitRepo();
  installHooks(repo);
  const res = installHooks(repo); // no --force needed; ours carry the marker
  assert.deepEqual(res.installed.sort(), ['post-commit', 'pre-push']);
  assert.equal(res.skipped.length, 0);
});

test('a foreign hook is preserved without --force, overwritten with it', () => {
  const repo = tmpGitRepo();
  const dest = path.join(repo, '.git', 'hooks', 'pre-push');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, '#!/bin/sh\necho mine\n');

  let res = installHooks(repo);
  assert.ok(res.skipped.some((s) => s.hook === 'pre-push'), 'foreign pre-push skipped');
  assert.equal(fs.readFileSync(dest, 'utf8'), '#!/bin/sh\necho mine\n', 'foreign hook untouched');

  res = installHooks(repo, { force: true });
  assert.ok(res.installed.includes('pre-push'));
  assert.match(fs.readFileSync(dest, 'utf8'), /trellis-managed-hook/);
});

test('installHooks throws outside a git repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-nogit-'));
  assert.throws(() => installHooks(dir), /not a git repository/);
});

test('HOOKS are no-op-safe: post-commit exits early without TRELLIS_MODEL', () => {
  assert.match(HOOKS['post-commit'], /\[ -n "\$TRELLIS_MODEL" \] \|\| exit 0/);
});
