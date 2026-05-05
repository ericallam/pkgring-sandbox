# Changesets

This directory holds in-flight changeset files. Each `.md` file describes a pending package version bump and ends up in the next release's CHANGELOG.

## Adding a changeset

```bash
pnpm run changeset:add
```

Pick the affected packages and bump types (patch / minor / major). The CLI writes a randomly-named `.md` file. Commit it with your change.

## What happens on merge to main

`changesets-pr.yml` opens a "Version Packages" PR (`changeset-release/main`) that consumes all pending changesets and bumps versions. Merging that PR triggers `release.yml`, which publishes to npm + GHCR + the Helm OCI registry.

## Hotfix flow (release branches)

See `../docs/RELEASE-BRANCHES.md` for the full procedure. Short version: cut `release/<major>.<minor>.x` from a release tag, cherry-pick the fix, add a patch changeset on the release branch, run `release.yml` with `ref: release/<major>.<minor>.x`.
