# pkgring-sandbox

Tracer-bullet sandbox for testing the release-branch flow we want to roll into `triggerdotdev/trigger.dev`. Real npm publishes, real Docker builds, real Helm chart pushes — small enough to iterate on, real enough that mistakes show up.

## What's here

| Piece              | Path                          | Notes                                                 |
| ------------------ | ----------------------------- | ----------------------------------------------------- |
| `@pkgring/core`    | `packages/core`               | No deps. Foundation package.                          |
| `@pkgring/sdk`     | `packages/sdk`                | Depends on `core`. Tests cross-package version cascade.|
| `@pkgring/cli`     | `packages/cli`                | Depends on `sdk` + `core`. Has a `bin`.               |
| `@pkgring/web`     | `apps/web`                    | Tiny Node HTTP server, packaged as a Docker image.    |
| Helm chart         | `charts/pkgring`              | References the web image.                             |
| Workflows          | `.github/workflows/*.yml`     | The actual artifact under test.                       |

## What it ships

A successful release publishes:

1. **npm**: `@pkgring/core@X.Y.Z`, `@pkgring/sdk@X.Y.Z`, `@pkgring/cli@X.Y.Z` (linked via `fixed`)
2. **Docker**: `ghcr.io/ericallam/pkgring-sandbox:vX.Y.Z` (multi-arch, `latest` only updated on main releases)
3. **Helm**: `oci://ghcr.io/ericallam/charts/pkgring:X.Y.Z`
4. **GitHub release**: `vX.Y.Z` with notes auto-generated from changesets

## One-time setup

1. **Push to GitHub**: `gh repo create ericallam/pkgring-sandbox --public --source=. --remote=origin --push`
2. **Create npm org `@pkgring`**: `npm org create pkgring` (or via npmjs.com UI)
3. **Configure trusted publishing** for each package (npmjs.com → package settings → Trusted Publishing):
   - Publisher: GitHub Actions
   - Repo: `ericallam/pkgring-sandbox`
   - Workflow: `release.yml`
   - Environment: `npm-publish`
4. **Create the `npm-publish` environment** in GitHub repo settings (no secrets needed; OIDC handles auth)
5. **Branch protection** on `main` and `release/*`: require PRs, allow squash merge

The Docker + Helm pipelines use `${{ secrets.GITHUB_TOKEN }}` and need no extra setup.

## Local commands

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run changeset:add        # add a changeset for a change
```

## Release flows

Three flows live side by side. They share workflow files; the difference is which branch the changesets live on and whether `.changeset/pre.json` is present.

`release.yml` figures out which flow you're in by inspecting the version it's about to publish and the current `latest` on npm. See the [decision table](docs/RC-FLOW.md#decision-table) for the full matrix.

### Normal (main)

1. Merge PRs to main with changesets
2. `changesets-pr.yml` opens / refreshes `changeset-release/main`
3. Merge that PR
4. `release.yml` publishes everything: npm under `latest`, Docker `:latest` + `:release-X.Y` updated, GitHub release marked Latest, marketing-site dispatch fires

### Hotfix (release branch)

See [docs/RELEASE-BRANCHES.md](docs/RELEASE-BRANCHES.md). TL;DR:

```bash
git switch -c release/1.2.x v1.2.0       # cut from the last good tag
git cherry-pick <fix-sha>                 # bring in the fix
pnpm run changeset:add                    # patch
git push origin release/1.2.x             # changesets-pr.yml opens
                                          # changeset-release/release/1.2.x
# ... merge that PR; release.yml ships v1.2.1.
```

If `1.2.1` is lower than the current npm `latest` (main has moved on), the hotfix publishes under dist-tag `release-1.2` and skips Docker `:latest` + GitHub Latest badge. The `:release-1.2` Docker line tag IS updated.

### Release candidate (pre-mode)

See [docs/RC-FLOW.md](docs/RC-FLOW.md). TL;DR:

```bash
git switch main
pnpm exec changeset pre enter rc          # creates .changeset/pre.json
git add .changeset/pre.json
git commit -m "chore: enter prerelease mode (rc)"
git push                                  # bot regenerates PR as v0.6.0-rc.0
# ... merge that PR; release.yml ships 0.6.0-rc.0 under dist-tag `rc`.
# Iterate: every new changeset merged to main bumps to rc.1, rc.2, …
# When stable-ready: `pnpm exec changeset pre exit`, push, merge → ships 0.6.0.
```

RC publishes never claim `latest`, skip the Docker `:latest` and `:release-X.Y` line tags, mark the GitHub release as Pre-release, and skip the marketing-site changelog dispatch. The stable cut-over (`pre exit`) restores all the Latest signals.

## Test plan

See [docs/TESTING.md](docs/TESTING.md) for thirteen scenarios — eight for the hotfix flow, five for the RC flow — to mechanically run before porting these workflows back to `trigger.dev`.

## Cost

Free. Public repo on GitHub (Actions minutes free), public npm org (free), GHCR (free for public packages). The only "cost" is npm version numbers — every test consumes them forever.
