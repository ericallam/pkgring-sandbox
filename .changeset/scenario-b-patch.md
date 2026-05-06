---
"@pkgring/sdk": patch
---

Scenario B test: ship 0.2.1 from release/0.2.x while main has unreleased 0.3.0 work queued. Expectation: 0.2.1 becomes :latest everywhere because it's higher than the current latest (0.2.0).
