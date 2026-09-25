// Model-provenance tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  classifyCommits, checkModelProvenance, loadModelPolicy, readProvenance, stampProvenance, PROVENANCE_FILE,
  composeAgentsMd
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

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');

function writePolicy(dir, yaml) {
  fs.mkdirSync(path.join(dir, 'governance'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'governance', 'model-policy.yaml'), yaml);
}

test('loadModelPolicy: this repository ships an opt-in (unconfigured) policy', () => {
  const policy = loadModelPolicy(REPO_ROOT);
  assert.ok(policy, 'repo declares governance/model-policy.yaml');
  assert.equal(policy.configured, false, 'allow-list is optional; the repo does not restrict its developers');
  assert.equal(policy.requireProvenance, true, 'fail-closed once an adopter configures a list');
});

test('loadModelPolicy: the skeleton template does not enforce an allow-list', () => {
  const policy = loadModelPolicy(path.join(REPO_ROOT, 'standard', 'repo-skeleton'));
  assert.ok(policy, 'skeleton ships governance/model-policy.yaml as an opt-in template');
  assert.equal(policy.configured, false);
});

test('loadModelPolicy: template placeholders are not configuration; a real id or a block-list is', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-policy-'));
  writePolicy(tmp, 'allowed_models: [your-primary-model, your-secondary-model]\n');
  assert.equal(loadModelPolicy(tmp).configured, false);
  writePolicy(tmp, 'allowed_models: [your-primary-model, good-model]\n');
  assert.deepEqual(loadModelPolicy(tmp).allowed, ['good-model']);
  assert.equal(loadModelPolicy(tmp).configured, true);
  writePolicy(tmp, 'allowed_models: []\ndisallow: [banned-model]\n');
  assert.equal(loadModelPolicy(tmp).configured, true);
});

test('checkModelProvenance is not-evaluated (neither pass nor fail) when no policy is declared', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-nopolicy-'));
  const r = checkModelProvenance(tmp);
  assert.equal(r.evaluated, false);
  assert.equal(r.ok, null, 'never a silent pass');
  assert.equal(r.configured, false);
});

for (const [name, yaml] of [
  ['absent allow-list', 'version: "0.1"\nrequire_provenance: true\nenforcement: block\n'],
  ['empty allow-list', 'version: "0.1"\nallowed_models: []\nrequire_provenance: true\nenforcement: block\n'],
  ['placeholder allow-list', 'version: "0.1"\nallowed_models: [your-primary-model]\nenforcement: block\n']
]) {
  test(`checkModelProvenance: ${name} is not evaluated - never a block, never a silent pass`, (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-optin-'));
    const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tmp, stdio: ['ignore', 'pipe', 'ignore'] });
    try { git('init', '-q'); } catch { return t.skip('git not available'); }
    writePolicy(tmp, yaml);
    fs.writeFileSync(path.join(tmp, 'a.txt'), '1');
    git('add', '-A'); git('commit', '-qm', 'unstamped');
    const r = checkModelProvenance(tmp);
    assert.equal(r.evaluated, false, 'unstamped history must not be judged without a configured list');
    assert.equal(r.ok, null);
    assert.equal(r.configured, false);
    assert.match(r.reason, /not configured/);
  });
}

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
  assert.equal(r.configured, true);
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

test('generated AGENTS.md states the model rule as conditional on a configured list', () => {
  const md = composeAgentsMd('backend');
  assert.match(md, /Authorized models only - when configured/);
  assert.match(md, /No list configured → no model restriction/);
});
