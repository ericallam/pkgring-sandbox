# Release-branch hotfix procedure

This is the procedure for shipping a hotfix that excludes commits already merged to `main`. Use it when `main` has commits you can't ship yet (incomplete features, risky refactors), but you need a patch on the last released version.

## Naming convention

- Release branches: `release/<major>.<minor>.x` — e.g. `release/1.2.x`
- One branch per `major.minor` line. `release/1.2.x` ships `1.2.1`, `1.2.2`, …

## Procedure

### 1. Cut the release branch from the last good release tag

```bash
git fetch --tags origin
git switch -c release/1.2.x v1.2.0
git push -u origin release/1.2.x
```

Always cut from the **tag**, not from main. Tags are immutable; cutting from main risks pulling in unmerged-but-pending commits and stale changesets.

### 2. Bring in the fix

If the fix is already on main:

```bash
git cherry-pick <fix-sha>
```

If the fix doesn't exist yet, write it on the release branch directly. Either way, also cherry-pick / write the equivalent fix onto main when you're done (see step 6).

### 3. Add a patch changeset

```bash
pnpm run changeset:add        # pick "patch" for the affected packages
git add .changeset/*.md
git commit -m "fix: <description>"
git push origin release/1.2.x
```

Pushing to `release/1.2.x` triggers `changesets-pr.yml`, which opens a `changeset-release/release/1.2.x` PR that bumps versions to `1.2.1`.

### 4. Merge the version PR

Reviews the version PR like any other release PR. Merging it triggers `release.yml`, which:

- Publishes `@pkgring/{core,sdk,cli}@1.2.1` to npm
- Pushes `ghcr.io/ericallam/pkgring-sandbox:v1.2.1` (does **not** touch `latest`)
- Pushes `oci://ghcr.io/ericallam/charts/pkgring:1.2.1`
- Creates GitHub release `v1.2.1`

### 5. Trigger manually if you skip the auto-PR

```bash
gh workflow run release.yml \
  --ref release/1.2.x \
  -f type=release \
  -f ref=release/1.2.x
```

### 6. Cherry-pick the fix back to main

Critical: pick the **fix commit only**, not the version-bump commit.

```bash
git switch main
git cherry-pick <fix-sha>
git push
```

Main's next release will naturally include the fix at whatever version is next on main. If main is heading to `1.3.0`, the fix ships there automatically.

If you accidentally cherry-pick the version-bump commit, you'll get a `package.json` conflict and the consumed changeset will be deleted. Reset and re-pick only the fix.

## Gotchas

### `latest` dist-tag

`changesets/action` updates the `latest` npm dist-tag whenever it publishes. For a hotfix on an old line, this is **wrong** — `1.2.1` shouldn't become `latest` if main is already at `1.5.0`.

**Mitigation**: after the hotfix release runs, manually retag:

```bash
npm dist-tag add @pkgring/core@1.5.0 latest
npm dist-tag add @pkgring/sdk@1.5.0 latest
npm dist-tag add @pkgring/cli@1.5.0 latest
```

Or, if you know the latest version that should hold `latest`, automate that step. (Test #8 in TESTING.md exercises this.)

### Docker `latest` tag

`publish.yml` only writes `latest` when `IS_SEMVER == true && REF == refs/heads/main`. Release-branch builds skip it. If you ever need to retag manually:

```bash
docker buildx imagetools create \
  -t ghcr.io/ericallam/pkgring-sandbox:latest \
  ghcr.io/ericallam/pkgring-sandbox:v1.5.0
```

### Helm chart `latest`

Helm OCI doesn't have a `latest` concept by default; consumers pin to a version. No mitigation needed.

### Changesets PR auto-stamps Chart.yaml

The `changesets-pr.yml` workflow rewrites `charts/pkgring/Chart.yaml` on the version PR branch so the Helm chart version matches the package version. This means you do NOT need to bump the chart manually.

### Stale changesets on main don't follow

If `main` has unconsumed changesets in `.changeset/` when you cut a release branch from a **tag**, those changesets don't come along (they were added after the tag). Good. If you ever cut a release branch from `main` HEAD instead of a tag, you'd accidentally pull them in. Don't do that.

### Two release branches alive at once

`release/1.2.x` and `release/1.3.x` can coexist. `release.yml`'s `concurrency.group: ${{ github.workflow }}` is repo-wide and serializes runs — so two simultaneous release branch publishes will queue, not collide. Trade-off: one slow run blocks the other. Acceptable.
