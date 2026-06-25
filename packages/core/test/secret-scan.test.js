// Secret-scan tests. Run: node --test packages/core/test/*.test.js
// Token literals on a line carry an inline `trellis-allow-secret` marker so that scanning THIS
// repo skips them, while detectSecrets() still receives the raw token and must flag it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectSecrets, scanSecrets } from '../src/index.js';

test('detects an AWS access key id', () => {
  assert.equal(detectSecrets('const k = "AKIAIOSFODNN7EXAMPLE"').length, 1); // trellis-allow-secret
});

test('detects a private key header and a GitHub token', () => {
  assert.equal(detectSecrets('-----BEGIN OPENSSH PRIVATE KEY-----')[0].rule, 'private-key'); // trellis-allow-secret
  assert.equal(detectSecrets('ghp_000000000000000000000000000000000000')[0].rule, 'github-token'); // trellis-allow-secret
});

test('detects a generic secret assignment but ignores placeholders', () => {
  assert.equal(detectSecrets('const password = "hunter2hunter2"').length, 1); // trellis-allow-secret
  assert.equal(detectSecrets('api_key = "your-api-key"').length, 0);
  assert.equal(detectSecrets('secret = "xxxxxxxx"').length, 0);
  assert.equal(detectSecrets('token = "${TOKEN}"').length, 0);
});

test('honors the inline allow marker', () => {
  assert.equal(detectSecrets('k = "AKIAIOSFODNN7EXAMPLE" // trellis-allow-secret').length, 0);
});

test('never leaks the secret itself - only rule, location and length', () => {
  const token = 'AKIAIOSFODNN7EXAMPLE'; // trellis-allow-secret
  const f = detectSecrets(token, { filename: 'a.js' })[0];
  assert.equal(f.length, '20 chars');
  assert.equal(f.file, 'a.js');
  assert.ok(!JSON.stringify(f).includes(token), 'finding must not contain the token');
});

test('scanSecrets: clean tree passes, a leaked file fails with its path', () => {
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-sec-ok-'));
  fs.writeFileSync(path.join(clean, 'a.js'), 'export const x = 1;\n');
  let r = scanSecrets(clean);
  assert.equal(r.ok, true);
  assert.ok(r.scanned >= 1);

  const leak = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-sec-leak-'));
  fs.writeFileSync(path.join(leak, 'config.js'), 'const k = "AKIAIOSFODNN7EXAMPLE";\n'); // trellis-allow-secret
  r = scanSecrets(leak);
  assert.equal(r.ok, false);
  assert.equal(r.findings[0].file, 'config.js');
  assert.equal(r.findings[0].rule, 'aws-access-key-id');
});

test('scanSecrets: a file-level allow marker is respected', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-sec-allow-'));
  fs.writeFileSync(path.join(tmp, 'fixture.js'), 'const k = "AKIAIOSFODNN7EXAMPLE"; // trellis-allow-secret\n');
  assert.equal(scanSecrets(tmp).ok, true);
});
