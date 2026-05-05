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
2. **Docker**: `ghcr.io/triggerdotdev/pkgring-sandbox:vX.Y.Z` (multi-arch, `latest` only updated on main releases)
3. **Helm**: `oci://ghcr.io/triggerdotdev/charts/pkgring:X.Y.Z`
4. **GitHub release**: `vX.Y.Z` with notes auto-generated from changesets

## One-time setup

1. **Push to GitHub**: `gh repo create triggerdotdev/pkgring-sandbox --public --source=. --remote=origin --push`
2. **Create npm org `@pkgring`**: `npm org create pkgring` (or via npmjs.com UI)
3. **Configure trusted publishing** for each package (npmjs.com → package settings → Trusted Publishing):
   - Publisher: GitHub Actions
   - Repo: `triggerdotdev/pkgring-sandbox`
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

Two flows live side by side. They share workflow files; the only difference is which branch the changesets and version bumps live on.

### Normal (main)

1. Merge PRs to main with changesets
2. `changesets-pr.yml` opens / refreshes `changeset-release/main`
3. Merge that PR
4. `release.yml` publishes everything

### Hotfix (release branch)

See [docs/RELEASE-BRANCHES.md](docs/RELEASE-BRANCHES.md). TL;DR:

```bash
git switch -c release/1.2.x v1.2.0       # cut from the last good tag
git cherry-pick <fix-sha>                 # bring in the fix
pnpm run changeset:add                    # patch
git push origin release/1.2.x             # changesets-pr.yml opens
                                          # changeset-release/release/1.2.x
# ... merge that PR; release.yml runs and ships v1.2.1.
```

## Test plan

See [docs/TESTING.md](docs/TESTING.md) for the eight scenarios we want to mechanically run before porting these workflows back to `trigger.dev`.

## Cost

Free. Public repo on GitHub (Actions minutes free), public npm org (free), GHCR (free for public packages). The only "cost" is npm version numbers — every test consumes them forever.
