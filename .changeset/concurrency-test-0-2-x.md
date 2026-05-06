---
"@pkgring/sdk": patch
---

Concurrency test fixture: ship 0.2.3 from release/0.2.x at the same time as 0.1.4 from release/0.1.x. Both should serialize behind the same release.yml concurrency group.
