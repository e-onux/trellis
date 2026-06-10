# {{Extension point}} Extension Contract

> Place this as `EXTENSIONS.md` in the directory that owns the extension point.
> It is the human-readable guide; the machine-readable companion lives in `extension-registry.yaml`
> (validated against standard/schemas/extension-contract.schema.json).
>
> **Registration over convention:** the files that must be updated to wire in an extension are listed
> here explicitly - not left to team memory, naming convention, or agent guesswork.

When a new {{extension type}} is added under `{{root}}/`, ALL of the following must be done.

## Required implementation

1. `{{root}}/<name>/`
   - implementation
   - extension-specific config
   - error mapping
   - unit + contract tests

## Required registration points

2. `{{registry-file}}` - add the entry, register the factory/adapter, declare supported capabilities
3. `{{config-schema}}` - add config fields; mark required/optional and secret fields
4. `.env.example` - add required environment variables (no real secrets)
5. `{{docs-path}}` - installation steps, usage example, limitations
6. `capabilities/<affected>/contract.yaml` - add scenarios this extension affects
7. `test-cockpit/manifest.yaml` - register test scenarios *(when cockpit is enabled)*
8. `CHANGELOG.md` - add the new extension

## Required checks

```
[ ] Registry entry present
[ ] Config schema valid
[ ] Environment variables documented
[ ] Contract tests pass
[ ] At least one error scenario present
[ ] Runnable in the user test cockpit
[ ] Removal/cleanup steps defined (see extension-removal-template.md)
```

## Inheritance

The root `EXTENSIONS.md` defines general rules. This file adds rules specific to this extension point.
An agent must read the nearest `EXTENSIONS.md` **and** the applicable general rules in parent directories.
