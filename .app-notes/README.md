# `.app-notes/` — server / app-only changes

This directory is the analog of trigger.dev's `.server-changes/`. Use it when a change affects the bundled web app (Docker image) but does NOT bump a published npm package — for example, a backend bugfix, a minor copy change, or a config tweak that doesn't ship as a package.

## Format

Drop a markdown file in `.app-notes/<short-id>.md` describing the change in 1–2 sentences. The body is rendered into the next GitHub release notes. Keep it concise — it has to fit as a single bullet under "App changes" in the release.

```markdown
Add health check endpoint for the load balancer.
```

## How it gets consumed

1. `.app-notes/*.md` files accumulate as PRs land on `main` (or `release/*`).
2. When `changesets-pr.yml` opens the next version PR, it deletes the consumed `.app-notes/*.md` files in the same commit (atomic with the version bump).
3. When that version PR is merged, `release.yml` reads the deleted files via `git show HEAD~1:.app-notes/*.md` and aggregates them into the GitHub release body.

So each release captures exactly the notes added since the previous release.

## When to use a changeset vs an app-note

| Change | Use |
|---|---|
| Bumps a published package | changeset (`pnpm run changeset:add`) |
| Server / app behavior, no package change | `.app-notes/<id>.md` |
| Docs-only, internal refactor with no behavior change | neither |
