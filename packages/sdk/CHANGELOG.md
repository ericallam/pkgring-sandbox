# @pkgring/sdk

## 0.1.3

### Patch Changes

- 93a7682: Trigger 0.1.3 from release/0.1.x to verify the conditional --tag fix. Expected: latest stays at 0.2.0, new dist-tag v0.1 appears at 0.1.3.
  - @pkgring/core@0.1.3

## 0.1.2

### Patch Changes

- 58fbb24: Cap input name length at 50 chars in `welcome()`. Test 8 hotfix shipped from `release/0.1.x` while main is at 0.2.0 — used to verify whether `changesets/action` overwrites the `latest` dist-tag with an older version.
  - @pkgring/core@0.1.2

## 0.1.1

### Patch Changes

- 72b44ff: Handle empty / whitespace-only names in `welcome()` by falling back to `"stranger"`. Used to greet `""`.
  - @pkgring/core@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [918a29d]
  - @pkgring/core@0.1.0
