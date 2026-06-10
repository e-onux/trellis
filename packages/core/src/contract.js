// Focused capability-contract validator. Enforces the rules that matter most in practice
// (required structure, id/version format, normal + error examples, budgets, verification levels).
// Not a full JSON-Schema validator - schemas/capability-contract.schema.json remains the formal spec.

const VERIFICATION_LEVELS = new Set(['required', 'recommended', 'optional', 'not-applicable']);
const STATUSES = new Set(['proposed', 'active', 'deprecated', 'superseded', 'blocked', 'experimental']);

/**
 * @param {object} contract parsed contract.yaml
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateContract(contract) {
  const errors = [];
  const warnings = [];
  const c = contract || {};

  const required = ['id', 'title', 'version', 'status', 'intent', 'responsibility', 'inputs', 'outputs', 'examples', 'budgets', 'verification'];
  for (const key of required) {
    if (c[key] === undefined || c[key] === null) errors.push(`missing required field: ${key}`);
  }

  if (c.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) errors.push(`id must be kebab-case: "${c.id}"`);
  if (c.version && !/^\d+\.\d+\.\d+$/.test(c.version)) errors.push(`version must be SemVer: "${c.version}"`);
  if (c.status && !STATUSES.has(c.status)) errors.push(`invalid status: "${c.status}"`);

  if (c.responsibility) {
    if (!Array.isArray(c.responsibility.does) || c.responsibility.does.length === 0) {
      errors.push('responsibility.does must list at least one thing the capability does');
    }
    if (!Array.isArray(c.responsibility.does_not) || c.responsibility.does_not.length === 0) {
      warnings.push('responsibility.does_not is empty - the semantic boundary is undefined');
    }
  }

  if (Array.isArray(c.examples)) {
    if (c.examples.length === 0) errors.push('examples must contain at least one scenario');
    const hasNormal = c.examples.some((e) => e && e.expected !== undefined);
    const hasError = c.examples.some((e) => e && e.expected_error !== undefined);
    if (!hasNormal) errors.push('at least one normal scenario (with `expected`) is required');
    if (!hasError) warnings.push('no error scenario (with `expected_error`) - strongly recommended');
    c.examples.forEach((e, i) => {
      if (!e || !e.name) warnings.push(`example #${i + 1} has no name`);
      if (e && e.input === undefined) errors.push(`example "${e?.name ?? i + 1}" has no input`);
    });
  } else if (c.examples !== undefined) {
    errors.push('examples must be a list');
  }

  if (c.budgets && typeof c.budgets === 'object') {
    for (const [k, v] of Object.entries(c.budgets)) {
      if (typeof v !== 'number' || v < 0) errors.push(`budget ${k} must be a non-negative number`);
    }
  }

  if (c.verification && typeof c.verification === 'object') {
    for (const [k, v] of Object.entries(c.verification)) {
      if (!VERIFICATION_LEVELS.has(v)) errors.push(`verification.${k} has invalid level "${v}"`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
