# Release Candidate (pre-mode) procedure

This is the procedure for shipping `X.Y.Z-rc.N` prerelease versions of `@pkgring/*` ahead of a stable `X.Y.Z`. Use it when you want testers to install via `@pkgring/core@rc` while `latest` stays on the previous stable.

Built on changesets' [pre mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md). `release.yml` detects pre mode via the hyphen-in-version check and skips Latest claims, the `:release-X.Y` Docker line tag, and marketing-site dispatch for the RC window.

## Naming convention

- Pre-mode tag: `rc` (the npm dist-tag prereleases publish under). Could be `beta`, `next`, etc. — set at `pre enter` time.
- RC versions: `X.Y.Z-rc.0`, `X.Y.Z-rc.1`, … bumped automatically on each new changeset.

## Procedure

### 1. Enter pre mode on main

```bash
git switch main
pnpm exec changeset pre enter rc
git add .changeset/pre.json
git commit -m "chore: enter prerelease mode (rc)"
git push
```

This creates `.changeset/pre.json` with `mode: "pre"` and `tag: "rc"`. The changesets bot picks this up immediately.

### 2. Wait for the bot to regenerate the release PR

Within ~30s, `changesets-pr.yml` rewrites `changeset-release/main`:

- PR title becomes `chore: release v<X.Y.Z>-rc.0`
- All packages bumped to `X.Y.Z-rc.0`
- `Chart.yaml` stamped to match
- `.changeset/*.md` files **stay on disk** (pre mode tracks consumed changesets in `pre.json.changesets[]` instead of deleting them)
- The "Release prep" PR header shows pre-mode framing (`scripts/enhance-release-pr.mjs` detects the hyphen)

### 3. Merge the release PR

Merging triggers `release.yml`, which:

- Publishes `@pkgring/{core,sdk,cli}@X.Y.Z-rc.0` to npm under dist-tag `rc` (read from `pre.json.tag` by `changesets/action`)
- `latest` dist-tag is **unchanged** — testers opt in via `@pkgring/core@rc`
- Pushes Docker image `ghcr.io/ericallam/pkgring-sandbox:vX.Y.Z-rc.0` (no `:latest`, no `:release-X.Y` line tag)
- Pushes Helm chart `oci://.../charts/pkgring:X.Y.Z-rc.0`
- Creates GitHub release `vX.Y.Z-rc.0` marked as Pre-release (no Latest badge)
- **Skips** the marketing-site changelog dispatch

### 4. Iterate to rc.1, rc.2, …

Each new feature/fix merged to main needs a changeset. The bot regenerates the release PR with the next `rc.N` and CHANGELOG entries only for the **new** changesets (the ones added since the last RC merge).

```bash
echo "// new" >> packages/sdk/src/index.ts
pnpm run changeset:add        # pick patch / minor as needed
git add . && git commit -m "feat(sdk): new thing"
git push
```

Merge the regenerated PR → publishes `rc.1`. Repeat as needed.

### 5. Exit pre mode and ship stable

When the RC line is ready to promote:

```bash
git switch main
pnpm exec changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit prerelease mode"
git push
```

`pre exit` flips `pre.json.mode` to `"exit"`. The bot regenerates the release PR:

- PR title becomes `chore: release v<X.Y.Z>` (no suffix)
- All packages bumped to stable `X.Y.Z`
- `.changeset/*.md` files are now consumed and deleted
- `pre.json` deleted from the PR branch
- CHANGELOG accumulates all changesets from the entire pre-mode window into the stable section

Merge → publishes `X.Y.Z` under `latest`, updates `:latest` Docker tag, updates `:release-X.Y` line tag, marks the GitHub release as Latest, fires the marketing-site dispatch.

## What ends up in CHANGELOG.md

After the stable ships, every published package's `CHANGELOG.md` looks like:

```
## X.Y.Z
- (cumulative — every changeset from rc.0 through stable)

## X.Y.Z-rc.1
- (just the delta after rc.0)

## X.Y.Z-rc.0
- (everything that was queued when pre mode started)
```

Stable's section is the complete story. RC sections are deltas — useful for grepping "what changed in rc.1 specifically".

## Decision table

What `release.yml` decides for a given version shape:

| Version shape       | `is_prerelease` | `is_latest` | npm dist-tag | `:latest` | `:release-X.Y` | GitHub Latest badge | Changelog dispatch |
|---------------------|-----------------|-------------|--------------|-----------|----------------|---------------------|--------------------|
| `1.0.0` (highest)   | false           | true        | `latest`     | ✅         | ✅              | ✅                   | ✅                  |
| `0.4.6` (lagged)    | false           | false       | `release-0.4`| ❌         | ✅              | ❌                   | ✅                  |
| `0.5.0-rc.0`        | true            | false       | `rc` (from pre.json) | ❌ | ❌              | ❌                   | ❌                  |
| `0.5.0-rc.1`        | true            | false       | `rc`         | ❌         | ❌              | ❌                   | ❌                  |

## Gotchas

### Can't publish a new RC without a new changeset

In pre mode, `changeset version` doesn't bump unless there's a new `.changeset/*.md` file to consume. If you need to re-publish (CI flake, packaging issue), either:

1. Add a genuine changeset for the underlying fix (preferred)
2. Add a no-op changeset just to force the bump
3. Use the snapshot path (`workflow_dispatch type=prerelease`) — different version shape (`0.0.0-rc-<timestamp>`), different dist-tag

### Main is "frozen" for stable hotfixes while pre.json is present

While pre mode is active on main, every merge produces an RC bump. To ship a real stable hotfix (e.g. `0.4.6` while `0.5.0-rc.N` is in flight), use the [release-branch flow](./RELEASE-BRANCHES.md) — cut `release/0.4.x` off the last good tag. That branch doesn't have `pre.json`, so its publishes go through the regular path (`release-0.4` dist-tag if main is at a higher version, `latest` otherwise).

### Docker `:latest` and `:release-X.Y` are NOT updated during RC window

Intentional. `:latest` tracks the highest *stable* release; `:release-X.Y` tracks the highest *stable* version on the X.Y line. Both move only when stable ships.

If you want a Docker image to test the RC, pull the immutable tag directly:

```bash
docker pull ghcr.io/ericallam/pkgring-sandbox:vX.Y.Z-rc.0
```

### Helm chart IS published for each RC

Helm OCI doesn't have a `latest` concept, so RCs publish without polluting any floating tag. Consumers always pin to a chart version.

```bash
helm upgrade --install pkgring \
  oci://ghcr.io/ericallam/charts/pkgring \
  --version "X.Y.Z-rc.0"
```

### Mid-pre-mode cherry-picks from release branches

If you cherry-pick a commit from a `release/X.Y.x` branch back to main while pre mode is active, the cherry-picked commit needs its **own** changeset on main — the original changeset is consumed on the release branch's CHANGELOG and can't be reused. The new changeset lands as another RC bump.
