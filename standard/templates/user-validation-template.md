# User Validation: {{capability}} / {{scenario}}

> Records a human's judgment that the output is *correct for the business* - distinct from "tests pass".
> Keeps the difference between "the test is green" and "the product is right".

```yaml
validation:
  capability: capability-id
  scenario: scenario-name
  status: approved          # approved | rejected | needs-changes
  approved_by: product-owner
  approved_at: 2026-01-01
  input: { }                # the input the user ran in the cockpit
  observed_output: { }      # what the capability actually produced
  notes: >
    Why this is (or isn't) acceptable from a product standpoint.
```
