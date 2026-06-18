// Model-provenance tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  classifyCommits, checkModelProvenance, loadModelPolicy, readProvenance, stampProvenance, PROVENANCE_FILE
} from '../src/index.js';

const POLICY = { allowed: ['good-model'], disallow: ['banned-model'], requireProvenance: true };

test('classifyCommits: allow-listed model passes', () => {
  const prov = new Map([['a', { model: 'good-model' }]]);
  const r = classifyCommits(['a'], prov, POLICY);
  assert.equal(r.ok, true);
  assert.equal(r.results[0].status, 'allowed');
});

test('classifyCommits: model not on the allow-list is disallowed', () => {
  const prov = new Map([['a', { model: 'some-other-model' }]]);
  const r = classifyCommits(['a'], prov, POLICY);
  assert.equal(r.ok, false);
  assert.equal(r.results[0].status, 'disallowed');
});

test('classifyCommits: explicitly blocked model is disallowed', () => {
  const prov = new Map([['a', { model: 'banned-model' }]]);
  const r = classifyCommits(['a'], prov, POLICY);
  assert.equal(r.results[0].status, 'disallowed');
});

test('classifyCommits: missing provenance is fail-closed (unverified) when required', () => {
  const r = classifyCommits(['a'], new Map(), POLICY);
  assert.equal(r.ok, false);
  assert.equal(r.results[0].status, 'unverified');
});

test('classifyCommits: missing provenance is exempt when provenance is not required', () => {
  const r = classifyCommits(['a'], new Map(), { ...POLICY, requireProvenance: false });
  assert.equal(r.ok, true);
  assert.equal(r.results[0].status, 'exempt');
});

test('stampProvenance + readProvenance round-trip; last write wins; bad lines skipped', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-prov-'));
  stampProvenance(tmp, { commit: 'sha1', model: 'good-model', agent: 'claude-code' });
  stampProvenance(tmp, { commit: 'sha1', model: 'good-model', at: '2026-06-18T00:00:00Z' });
  fs.appendFileSync(path.join(tmp, PROVENANCE_FILE), 'not json\n');
  const map = readProvenance(tmp);
  assert.equal(map.size, 1);
  assert.equal(map.get('sha1').at, '2026-06-18T00:00:00Z');
  assert.throws(() => stampProvenance(tmp, { commit: 'x' }));
});

test('loadModelPolicy reads this repository own policy', () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
  const policy = loadModelPolicy(repoRoot);
  assert.ok(policy, 'repo declares governance/model-policy.yaml');
  assert.ok(policy.allowed.includes('claude-opus-4-8'));
  assert.equal(policy.requireProvenance, true);
});

test('checkModelProvenance is not-evaluated (and passing) when no policy is declared', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-nopolicy-'));
  const r = checkModelProvenance(tmp);
  assert.equal(r.evaluated, false);
  assert.equal(r.ok, true);
});

test('checkModelProvenance over a real git repo: fail-closed, then passes once stamped', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-git-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tmp, stdio: ['ignore', 'pipe', 'ignore'] });
  try { git('init', '-q'); } catch { return t.skip('git not available'); }

  fs.mkdirSync(path.join(tmp, 'governance'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'governance', 'model-policy.yaml'),
    'version: "0.1"\nallowed_models: [good-model]\nrequire_provenance: true\nenforcement: block\n');

  fs.writeFileSync(path.join(tmp, 'a.txt'), '1');
  git('add', '-A'); git('commit', '-qm', 'first');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tmp, encoding: 'utf8' }).trim();

  // No provenance yet -> fail-closed.
  let r = checkModelProvenance(tmp);
  assert.equal(r.evaluated, true);
  assert.equal(r.ok, false, 'unstamped commit must fail');

  // Stamp with an allowed model -> passes.
  stampProvenance(tmp, { commit: sha, model: 'good-model' });
  r = checkModelProvenance(tmp);
  assert.equal(r.ok, true, JSON.stringify(r.violations));

  // A second commit authored by a disallowed model -> fails again.
  fs.writeFileSync(path.join(tmp, 'b.txt'), '2');
  git('add', '-A'); git('commit', '-qm', 'second');
  const sha2 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tmp, encoding: 'utf8' }).trim();
  stampProvenance(tmp, { commit: sha2, model: 'banned-model' });
  r = checkModelProvenance(tmp);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.status === 'disallowed'));
});
