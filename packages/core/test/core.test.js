// Core engine tests. Run: node --test packages/core/test/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContract, budgetCheck, init, audit, readYaml } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const exampleDir = path.join(repoRoot, 'examples', 'calculate-shipping-cost');

test('validateContract accepts the worked example contract', () => {
  const contract = readYaml(path.join(exampleDir, 'contract.yaml'));
  const r = validateContract(contract);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateContract rejects a contract missing required fields and bad id', () => {
  const r = validateContract({ id: 'Bad_Id', version: '1.0', status: 'nope', examples: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('id must be kebab-case')));
  assert.ok(r.errors.some((e) => e.includes('version must be SemVer')));
  assert.ok(r.errors.some((e) => e.includes('invalid status')));
});

test('validateContract warns when there is no error scenario', () => {
  const contract = readYaml(path.join(exampleDir, 'contract.yaml'));
  contract.examples = contract.examples.filter((e) => !e.expected_error);
  const r = validateContract(contract);
  assert.ok(r.warnings.some((w) => w.includes('error scenario')));
});

test('budgetCheck measures the example and stays within budget', () => {
  const b = budgetCheck(exampleDir, { repoRoot });
  assert.equal(b.ok, true, b.violations.join('; '));
  const files = b.checks.find((c) => c.budget === 'max_files');
  assert.ok(files.measurable && files.measured >= 1);
});

test('budgetCheck flags an over-budget capability', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-budget-'));
  fs.writeFileSync(path.join(tmp, 'contract.yaml'), readYamlString());
  fs.writeFileSync(path.join(tmp, 'a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(tmp, 'b.js'), 'export const b = 2;\n');
  const b = budgetCheck(tmp, { repoRoot: tmp });
  assert.equal(b.ok, false);
  assert.ok(b.violations.some((v) => v.startsWith('max_files')));
});

function readYamlString() {
  // contract with max_files: 1 so two files breach it.
  return [
    'id: tiny', 'title: Tiny', 'version: 1.0.0', 'status: active',
    'intent: { description: x }',
    'responsibility: { does: [x], does_not: [y] }',
    'inputs: { a: { type: string } }', 'outputs: { b: { type: string } }',
    'examples:', '  - { name: ok, input: { a: x }, expected: { b: y } }',
    'budgets: { max_files: 1 }',
    'verification: { contract: required }', ''
  ].join('\n');
}

test('init scaffolds a governed repo and audit passes on it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-init-'));
  const res = init({ repoRoot: tmp, profile: 'backend', preset: 'standard', agents: ['claude', 'codex', 'cursor'] });
  assert.ok(res.created.includes('AGENTS.md'));
  assert.ok(fs.existsSync(path.join(tmp, 'governance', 'constitution.md')));
  assert.ok(fs.existsSync(path.join(tmp, '.trellis.yaml')));
  assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'trellis.mdc')));
  assert.ok(!fs.existsSync(path.join(tmp, 'codex.md')), 'codex uses AGENTS.md natively');

  const report = audit(tmp);
  assert.equal(report.summary.capabilities, 0);
  assert.equal(report.ok, true, 'fresh scaffold should pass enforced gates');
});

test('audit on the example capability (copied into a scaffold) is healthy', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-audit-'));
  init({ repoRoot: tmp, profile: 'backend', preset: 'standard' });
  const dest = path.join(tmp, 'capabilities', 'calculate-shipping-cost');
  fs.cpSync(exampleDir, dest, { recursive: true });
  const report = audit(tmp);
  assert.equal(report.summary.capabilities, 1);
  assert.equal(report.summary.healthy, 1, JSON.stringify(report.capabilities[0]));
  assert.equal(report.ok, true);
});
