// Contract test: drives the implementation with every example in contract.yaml and checks expected vs actual.
// Run from the repo root:  node --test examples/calculate-shipping-cost/tests/contract.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { calculateShippingCost } from '../adapter/shipping-cost.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = YAML.parse(fs.readFileSync(path.join(here, '..', 'contract.yaml'), 'utf8'));

for (const example of contract.examples) {
  test(`contract example: ${example.name}`, () => {
    if (example.expected_error) {
      assert.throws(() => calculateShippingCost(example.input), (e) => e.code === example.expected_error.code);
    } else {
      const actual = calculateShippingCost(example.input);
      assert.deepEqual(actual, example.expected);
    }
  });
}

test('invariant: amount is never negative across the valid weight range', () => {
  for (let w = 0.01; w <= 30; w += 0.5) {
    for (const method of ['standard', 'express']) {
      const r = calculateShippingCost({ destination: 'DE', weight_kg: w, method });
      assert.ok(r.amount.value >= 0);
      assert.ok(r.estimated_days >= 1);
    }
  }
});
