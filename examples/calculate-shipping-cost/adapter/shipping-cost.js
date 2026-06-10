// Reference implementation for the `calculate-shipping-cost` capability.
// Kept deliberately small - the contract (contract.yaml) is the source of truth; this satisfies it.

const PRICING = {
  standard: { base: 2.99, perKg: 1.0, days: 3 },
  express: { base: 7.99, perKg: 2.0, days: 1 }
};

// destination-zone-resolver (inlined for the example): DE is domestic; others add a surcharge + days.
function resolveZone(destination) {
  return destination === 'DE'
    ? { surcharge: 0.0, extraDays: 0 }
    : { surcharge: 5.0, extraDays: 2 };
}

export class InvalidWeightError extends Error {
  constructor() {
    super('weight_kg must be between 0.01 and 30');
    this.code = 'INVALID_WEIGHT';
  }
}

/**
 * @param {{ destination: string, weight_kg: number, method: 'standard'|'express' }} input
 * @returns {{ amount: { currency: 'EUR', value: number }, estimated_days: number }}
 */
export function calculateShippingCost({ destination, weight_kg, method }) {
  if (typeof weight_kg !== 'number' || weight_kg < 0.01 || weight_kg > 30) {
    throw new InvalidWeightError();
  }
  const tier = PRICING[method];
  if (!tier) {
    const err = new Error(`unknown method: ${method}`);
    err.code = 'INVALID_METHOD';
    throw err;
  }
  const zone = resolveZone(destination);
  const value = Math.round((tier.base + tier.perKg * weight_kg + zone.surcharge) * 100) / 100;
  return { amount: { currency: 'EUR', value }, estimated_days: tier.days + zone.extraDays };
}
