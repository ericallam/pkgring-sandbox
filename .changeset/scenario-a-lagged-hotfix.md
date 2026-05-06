---
"@pkgring/sdk": patch
---

Scenario A test: ship 0.2.2 from release/0.2.x while main has shipped 0.3.0. Expectation: 0.2.2 does NOT become :latest (which stays at 0.3.0); goes to dist-tag release-0.2 and Docker :release-0.2 only.
