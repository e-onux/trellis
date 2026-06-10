# Security Policy

Baseline security rules for capabilities and extensions.

- Validate all external input at the capability boundary.
- Least privilege for data access; document which capability may touch which data.
- Secrets via environment/secret store only - never in the repo. `.env.example` documents names, not values.
- Authz checks belong to a capability, not scattered in UI.
- For LLM capabilities: guard against prompt injection and data exfiltration; treat retrieved/user content as untrusted.

Security-sensitive changes are a human-approval gate (see `governance/human-approval-policy.md`).
