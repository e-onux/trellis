# Evidence for `calculate-shipping-cost`

This folder links the capability to the sources that justify its expected behavior (pricing tables, carrier
SLAs, zone definitions). In a real project, reference `source-*` ids from `sources/bibliography.yaml` here and
in the contract's `evidence:` field, completing the chain:

```
Source (carrier pricing sheet) → Claim (price per kg by zone) → Capability (calculate-shipping-cost) → Test
```

This example ships with no real sources, so `evidence: []` in the contract - and that is itself visible.
