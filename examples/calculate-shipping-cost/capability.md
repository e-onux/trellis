# Capability: Calculate shipping cost

> Given a destination, package weight and delivery method, return the shipping price and an estimated number
> of delivery days. A worked Trellis example - run `trellis validate --capability --root .` from this folder.

- **id:** `calculate-shipping-cost`
- **owner:** checkout
- **status:** active
- **contract:** [`contract.yaml`](./contract.yaml)
- **implementation:** [`adapter/shipping-cost.js`](./adapter/shipping-cost.js)
- **contract test:** [`tests/contract.test.js`](./tests/contract.test.js)

## What it does
- calculate shipping price
- estimate delivery duration

## What it does NOT do
- create orders · process payments · send emails  ← these are *other* capabilities

## Scenarios
- **Normal:** DE / 2 kg / standard → €4.99, 3 days
- **Normal:** DE / 2 kg / express → €11.99, 1 day
- **Error:** weight −1 kg → `INVALID_WEIGHT`

## Verification
Run in the cockpit (enter destination/weight/method, compare expected vs actual) and via the contract test,
which drives every example in `contract.yaml`.

## Changelog
- `1.0.0` - initial capability.
