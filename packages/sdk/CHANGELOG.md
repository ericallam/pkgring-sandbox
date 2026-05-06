# @pkgring/sdk

## 0.2.2

### Patch Changes

- fa23d75: Scenario A test: ship 0.2.2 from release/0.2.x while main has shipped 0.3.0. Expectation: 0.2.2 does NOT become :latest (which stays at 0.3.0); goes to dist-tag release-0.2 and Docker :release-0.2 only.
  - @pkgring/core@0.2.2

## 0.2.1

### Patch Changes

- 23e2481: Scenario B test: ship 0.2.1 from release/0.2.x while main has unreleased 0.3.0 work queued. Expectation: 0.2.1 becomes :latest everywhere because it's higher than the current latest (0.2.0).
  - @pkgring/core@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [e570f91]
  - @pkgring/core@0.2.0

## 0.1.0

### Patch Changes

- Updated dependencies [918a29d]
  - @pkgring/core@0.1.0
