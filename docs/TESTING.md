# Testing the release pipeline

Thirteen scenarios to mechanically run before we port these workflows back to `trigger.dev`. Each one is a checklist — go through them in order, observe what happens, write down what breaks.

Tests 1–8 cover the hotfix flow (release branches). Tests 9–13 cover the RC pre-mode flow ([RC-FLOW.md](./RC-FLOW.md)).

Each test consumes npm version numbers forever. Use a major version per session: session 1 uses `0.x`, session 2 uses `1.x`, etc.

## Setup

- Repo at `ericallam/pkgring-sandbox`, pushed to GitHub
- npm org `@pkgring` exists, trusted publishing configured for `core`, `sdk`, `cli`
- Local clone, branch protection disabled until tests pass once

## Test 1 — Baseline release from main

**Goal:** Confirm the happy path works end-to-end before testing branches.

```bash
git switch main
echo "// nudge" >> packages/core/src/index.ts
pnpm run changeset:add   # minor on @pkgring/core
git add . && git commit -m "feat(core): nudge"
git push
```

**Expect:**

- `changesets-pr.yml` opens `changeset-release/main` proposing `0.1.0` for all three packages
- Merging that PR triggers `release.yml`
- npm: `@pkgring/{core,sdk,cli}@0.1.0` published
- GHCR: `ghcr.io/ericallam/pkgring-sandbox:v0.1.0` and `:latest`
- GHCR OCI: `charts/pkgring:0.1.0`
- Git tags: `@pkgring/core@0.1.0`, `@pkgring/sdk@0.1.0`, `@pkgring/cli@0.1.0`, `v0.1.0`, `v.docker.0.1.0`, `helm-v0.1.0`
- GitHub release `v0.1.0`

**Verify:** `npm install -g @pkgring/cli@0.1.0 && pkgring claude` prints the greeting JSON.

## Test 2 — Hotfix from a release tag

**Goal:** The headline scenario.

```bash
git switch -c release/0.1.x v0.1.0
git push -u origin release/0.1.x

# Make a tiny fix on the branch (or cherry-pick from main)
echo "// hotfix" >> packages/sdk/src/index.ts
pnpm run changeset:add  # patch on @pkgring/sdk
git add . && git commit -m "fix(sdk): hotfix"
git push
```

**Expect:**

- `changesets-pr.yml` opens `changeset-release/release/0.1.x` proposing `0.1.1`
- Merging triggers `release.yml`
- npm: `@pkgring/{core,sdk,cli}@0.1.1` (note: `core` bumps too because of the `fixed` config)
- GHCR: `:v0.1.1` BUT `:latest` is **unchanged** (still pointing at v0.1.0)
- Helm chart `0.1.1` published

**Verify:**
- `npm view @pkgring/core dist-tags.latest` — what does it show? See Test 8.
- `docker pull ghcr.io/ericallam/pkgring-sandbox:latest` should still resolve to v0.1.0.

## Test 3 — Hotfix while main has moved

**Goal:** Pending changesets on main don't bleed into the hotfix.

```bash
git switch main
# add several changesets on main without releasing
echo "// 1" >> packages/core/src/index.ts
pnpm run changeset:add   # minor
git add . && git commit -m "feat: change 1" && git push
echo "// 2" >> packages/sdk/src/index.ts
pnpm run changeset:add   # patch
git add . && git commit -m "feat: change 2" && git push

# now hotfix from v0.1.0 (NOT v0.1.1, to keep test isolated)
git switch -c release/0.1.x-test3 v0.1.0   # use a different branch name
git cherry-pick <fix-sha>
pnpm run changeset:add   # patch
git push
```

**Expect:**

- `changeset-release/release/0.1.x-test3` PR contains only the new patch changeset, not the two on main
- Released version is `0.1.1` again? No — npm will reject the duplicate. This is the version-collision gotcha. Use a different branch and bump to `0.1.2` in this test.

**Verify:** main's pending changesets remain untouched in `.changeset/` on main.

## Test 4 — Cherry-pick fix back to main

**Goal:** Confirm cherry-picking the fix to main doesn't clash with the version bump on the release branch.

```bash
git switch main
git cherry-pick <fix-sha-only>   # NOT the version bump commit
```

**Expect:** Clean cherry-pick. No conflict on `package.json` or `.changeset/`.

**Anti-test:**

```bash
git cherry-pick <version-bump-sha>
```

**Expect:** Conflict on every `package.json` and a deleted `.changeset/<name>.md`. Confirms the warning in RELEASE-BRANCHES.md is real.

## Test 5 — Cross-package version cascade

**Goal:** Patching `core` should auto-bump `sdk` and `cli` because they depend on it.

```bash
git switch main
echo "// 5" >> packages/core/src/index.ts
pnpm run changeset:add   # patch on @pkgring/core ONLY
git add . && git commit -m "fix(core): cascade test" && git push
```

**Expect:** The release PR proposes a patch bump on all three packages, even though only `core` had a changeset. Reason: `updateInternalDependencies: patch` in `.changeset/config.json`.

**Verify:** `sdk` and `cli` dependency ranges in the published `package.json` files reference the new `core` version.

## Test 6 — Two release branches alive at once

**Goal:** `release/0.1.x` and `release/0.2.x` can coexist. Concurrency group serializes them.

```bash
# After 0.2.0 ships from main, cut a second release branch:
git switch -c release/0.2.x v0.2.0
git push -u origin release/0.2.x
# Add a changeset and merge the version PR

# Simultaneously trigger a hotfix on release/0.1.x (the existing branch)
```

**Expect:** Both run. Second one queues. Both ship correctly. No tag collision (because versions differ).

## Test 7 — Stale changeset on hotfix branch

**Goal:** What if someone leaves an old changeset on the release branch and we re-run the workflow?

```bash
# On release/0.1.x, after 0.1.2 was already shipped:
git switch release/0.1.x
ls .changeset/   # should be empty of consumed changesets

# Manually drop a stray changeset from somewhere
cp /tmp/some-changeset.md .changeset/
git add . && git commit -m "test: stray changeset" && git push
```

**Expect:** `changesets-pr.yml` opens a new version PR proposing `0.1.3`. Merging ships it.

## Test 8 — Lagged minor (the `latest` clobber)

**Goal:** Confirm what happens when you ship `0.1.5` while main is on `0.5.0`. Is `latest` clobbered?

```bash
# Assumes main is at 0.5.0 already. Hotfix release/0.1.x → 0.1.5.
```

**Expect (predicted):** `changesets/action` updates `latest` on each published package to `0.1.5`. **This is wrong.**

**Verify:** `npm view @pkgring/core dist-tags` after the hotfix.

**If broken:** decide whether to:
- (a) Manually retag `latest` after every hotfix (documented step)
- (b) Add a workflow step that detects "hotfix version < main's latest" and re-pins `latest`
- (c) Use a per-line dist-tag (`v0.1`, `v0.2`) instead of `latest`

This is the test that informs a real design decision. Don't skip it.

## Test 9 — First RC publish (pre-mode entry)

**Goal:** Confirm pre mode publishes `X.Y.Z-rc.0` under dist-tag `rc`, leaves `latest` alone, and gates the downstream Latest signals correctly.

**Prereq:** A previous stable release is already on npm (e.g. `0.5.0` shipped via Test 1). Add a few changesets on main that haven't been released yet.

```bash
git switch main
pnpm exec changeset pre enter rc
git add .changeset/pre.json
git commit -m "chore: enter prerelease mode (rc)"
git push
```

**Expect:**

- `changesets-pr.yml` regenerates `changeset-release/main` with title `chore: release v0.6.0-rc.0`
- PR body header reads "Release prep — Release Candidate" (via `enhance-release-pr.mjs` detecting the hyphen)
- `.changeset/*.md` files are STILL present on the PR branch (pre mode tracks them in `pre.json.changesets[]`)
- `Chart.yaml` stamped to `0.6.0-rc.0`
- Merging triggers `release.yml`
- npm: `@pkgring/{core,sdk,cli}@0.6.0-rc.0` published under dist-tag `rc`
- GHCR: `:v0.6.0-rc.0` only — **no `:latest`, no `:release-0.6`**
- Helm: `oci://.../charts/pkgring:0.6.0-rc.0`
- GitHub release marked as Pre-release (badge shows "Pre-release", not "Latest")
- `dispatch-changelog` job is **skipped** (visible in the Actions summary)

**Verify:**

```bash
npm view @pkgring/core dist-tags
# Expected: { latest: '0.5.0', rc: '0.6.0-rc.0' }

npm install -g @pkgring/cli@rc && pkgring claude
# Should install the RC

npm install -g @pkgring/cli
# Should still install 0.5.0

docker pull ghcr.io/ericallam/pkgring-sandbox:latest
# Should still resolve to v0.5.0

docker pull ghcr.io/ericallam/pkgring-sandbox:release-0.5
# Should still resolve to v0.5.0 (not bumped)

docker manifest inspect ghcr.io/ericallam/pkgring-sandbox:release-0.6 2>&1
# Should fail — tag doesn't exist yet
```

## Test 10 — Iterate to rc.1

**Goal:** A new changeset merged to main bumps to `rc.1`. CHANGELOG and PR body show only the delta from rc.0.

```bash
echo "// rc.1 change" >> packages/sdk/src/index.ts
pnpm run changeset:add        # patch on @pkgring/sdk
git add . && git commit -m "fix(sdk): rc.1 nudge"
git push
```

**Expect:**

- `changesets-pr.yml` regenerates the PR with title `chore: release v0.6.0-rc.1`
- PR body lists only the new changeset (NOT the ones consumed in rc.0)
- `.changeset/pre.json.changesets[]` now has both rc.0's and the new entries
- Merge → npm `0.6.0-rc.1` under dist-tag `rc`
- Each package's `CHANGELOG.md` now has a `## 0.6.0-rc.1` section with only the new entry

**Verify:**

```bash
npm view @pkgring/core dist-tags
# Expected: { latest: '0.5.0', rc: '0.6.0-rc.1' }

# Read the CHANGELOG to confirm rc.0 entries are not duplicated in the rc.1 section
gh release view v0.6.0-rc.1 --json body --jq '.body'
```

## Test 11 — Exit pre mode and ship stable

**Goal:** `pre exit` triggers a stable release that cumulatively includes every RC's changesets.

```bash
git switch main
pnpm exec changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit prerelease mode"
git push
```

**Expect:**

- `changesets-pr.yml` regenerates the PR with title `chore: release v0.6.0`
- `.changeset/*.md` files are now all consumed and deleted (no longer pre-mode)
- `pre.json` removed from the PR branch
- PR body lists every changeset from rc.0 + rc.1 cumulatively
- Each package's `CHANGELOG.md` has a `## 0.6.0` section containing all changes from the RC window
- Merge → npm `0.6.0` under dist-tag `latest`
- GHCR: `:v0.6.0`, `:latest`, `:release-0.6` all updated
- Helm: `oci://.../charts/pkgring:0.6.0`
- GitHub release marked as Latest (NOT Pre-release)
- `dispatch-changelog` fires

**Verify:**

```bash
npm view @pkgring/core dist-tags
# Expected: { latest: '0.6.0', rc: '0.6.0-rc.1' }
# Note: `rc` still points at the last RC. Optional cleanup:
npm dist-tag rm @pkgring/core rc

docker pull ghcr.io/ericallam/pkgring-sandbox:latest
# Resolves to v0.6.0

docker pull ghcr.io/ericallam/pkgring-sandbox:release-0.6
# Resolves to v0.6.0
```

## Test 12 — Hotfix from a release branch while RCs are in flight on main

**Goal:** A stable hotfix from `release/0.5.x` works correctly even though main is in pre mode.

**Prereq:** Re-enter pre mode on main (Test 9 again) so `pre.json` is present.

```bash
git switch -c release/0.5.x v0.5.0
git push -u origin release/0.5.x

# Add a fix
echo "// hotfix" >> packages/core/src/index.ts
pnpm run changeset:add        # patch
git add . && git commit -m "fix(core): 0.5.1 hotfix"
git push
```

**Expect:**

- `changesets-pr.yml` opens `changeset-release/release/0.5.x` proposing `0.5.1`
- The PR's `enhance-release-pr.mjs` header reads "Release prep" (no RC framing — `pre.json` exists on main but NOT on this branch)
- `willBeLatest = true` because `0.5.1 > 0.5.0` (current latest stable; the `rc` dist-tag is ignored by version comparison)
- Merge → npm `0.5.1` under `latest`
- GHCR: `:v0.5.1`, `:latest`, `:release-0.5` all updated
- Important: the in-flight RC on main is NOT disturbed. Pre.json is still on main; the next RC merge will produce `rc.2` against the new stable baseline.

**Verify:**

```bash
npm view @pkgring/core dist-tags
# Expected: { latest: '0.5.1', rc: '0.6.0-rc.1' }
```

## Test 13 — Trying to publish rc.N with no new changesets

**Goal:** Confirm the gotcha — pre mode without new changesets is a no-op.

```bash
git switch main
# DON'T add a changeset
git commit --allow-empty -m "chore: no-op nudge"
git push
```

**Expect:**

- `changesets-pr.yml` runs but produces no PR update (no changesets to consume)
- If a PR is already open from the previous RC, it stays as-is
- If you somehow force a `changeset version` run with no new changesets, it exits 0 with "No unreleased changesets found"
- No way to publish `rc.2` without adding a changeset (genuine, dummy, or fallback to the snapshot path)

## Reset between sessions

To start fresh:

```bash
# Delete release branches
for b in $(git branch -r | grep 'origin/release/'); do
  git push origin --delete "${b#origin/}"
done

# Tags persist; bump major version for the next session
```

You can NOT re-publish the same npm version. Every test consumes versions; that's the cost.
