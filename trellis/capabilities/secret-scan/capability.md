# Capability: secret-scan

The one **mechanically enforced** rule of the [security manifesto](../../governance/security-manifesto.md):
no committed secrets. It scans tracked files (or a `--staged` / `--since <ref>` diff) for credentials,
keys and tokens and fails closed on a hit, so CI or a pre-commit hook can block the leak before it lands.

- **High-signal rules** - private keys, and provider patterns (AWS, GitHub, Slack, Google, Stripe,
  Anthropic, OpenAI), plus one generic `key = "value"` rule that is **placeholder-guarded** (skips
  `your-...`, `xxxx`, `${VAR}`, `process.env....`, etc.).
- **Never leaks** - a finding carries the rule, `file:line` and the secret's length, never the value.
- **Allowlist** - an inline `trellis-allow-secret` (or `pragma: allowlist secret`, `gitleaks:allow`)
  comment on a line suppresses it, for intentional fixtures and documentation.

`scanSecrets` / pure `detectSecrets` live in
[`packages/core/src/secret-scan.js`](../../packages/core/src/secret-scan.js); the CLI exposes
`trellis secret-scan` (non-zero exit on a finding).

**Boundary** (see [ADR-0006](../../tech/decisions/ADR-0006-security-manifesto.md)): this is a
high-signal secret detector, **not** a SAST tool. Deep vulnerability analysis is delegated to
dedicated tools (Semgrep, CodeQL) in CI - Trellis governs, it does not re-implement a scanner.
