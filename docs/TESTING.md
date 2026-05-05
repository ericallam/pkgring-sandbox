# Testing the release pipeline

Eight scenarios to mechanically run before we port these workflows back to `trigger.dev`. Each one is a checklist — go through them in order, observe what happens, write down what breaks.

Each test consumes npm version numbers forever. Use a major version per session: session 1 uses `0.x`, session 2 uses `1.x`, etc.

## Setup

- Repo at `triggerdotdev/pkgring-sandbox`, pushed to GitHub
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
- GHCR: `ghcr.io/triggerdotdev/pkgring-sandbox:v0.1.0` and `:latest`
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
- `docker pull ghcr.io/triggerdotdev/pkgring-sandbox:latest` should still resolve to v0.1.0.

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
