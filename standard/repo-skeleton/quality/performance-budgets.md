# Performance Budgets

Latency, throughput and memory limits. Define globally here and override per capability in `contract.yaml`.

| Scope | Metric | Budget |
|---|---|---|
| default API capability | p95 latency | ... ms |
| default batch step | throughput | ... rows/s |

Exceeding a performance budget is an upgrade/refactor trigger (see `tech/upgrade-policy.md`).
