# Removing a {{extension type}}

> Removal is a first-class operation in Trellis. Adding an extension without a removal plan leaves orphan
> registry/config/route entries behind. Every extension contract must define how to take it out cleanly.

When removing `{{name}}` from `{{root}}/`:

```
[ ] Delete the registry entry ({{registry-file}})
[ ] Remove config schema fields ({{config-schema}})
[ ] Remove now-unused environment variables (.env.example)
[ ] Clean up route / permission / menu / event / hook registrations
[ ] Decide on data: migration to remove tables, or documented retention
[ ] Remove or archive test-cockpit scenarios
[ ] Update user and developer documentation
[ ] Evaluate capability-contract impact (affected scenarios)
[ ] Write breaking-change and migration notes
[ ] Scan for orphan config / registry entries
[ ] CHANGELOG.md entry
```

## Verification

Run the extension completeness/orphan check after removal:

```bash
trellis extension validate {{extension-id}}
```
