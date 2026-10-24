# Capabilities

Every meaningful, user- or system-visible behavior is a capability with a bounded contract. This index lists
them; `capability-map.yaml` is the machine-readable map used by `trellis audit` and the cockpit.

| Capability | Status | Owner | Contract |
|---|---|---|---|
| _none yet_ | | | |

## Adding a capability

```bash
trellis capability add <id>      # scaffolds capabilities/<id>/ from templates
```

Or copy the templates (https://github.com/e-onux/trellis/tree/main/standard/templates: `capability-template.md` + `contract-template.yaml`) by hand. Then fill in the
contract, add at least one normal and one error example, and wire it into `capability-map.yaml`.
