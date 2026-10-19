#!/usr/bin/env node
// Renders the GitHub release body. Inputs:
//   argv[2] = unified version (e.g. "1.2.3" or "0.5.0-rc.0")
//   argv[3] = JSON string of publishedPackages (changesets/action output)
//   argv[4] = "true" if this version is the new global :latest (else "false")
//   argv[5] = "true" if this is a prerelease (hyphen in version) (else "false")
//
// Output: markdown to stdout.

import { execSync } from "node:child_process";

const version = process.argv[2];
const publishedJson = process.argv[3] ?? "[]";
const isLatest = process.argv[4] === "true";
const isPrerelease = process.argv[5] === "true";

if (!version) {
  console.error(
    "usage: generate-github-release.mjs <version> <publishedPackagesJson> <isLatest> <isPrerelease>"
  );
  process.exit(1);
}

let published = [];
try {
  published = JSON.parse(publishedJson);
} catch {
  published = [];
}

const refName = process.env.GITHUB_REF_NAME ?? "(unknown ref)";
const sha = (process.env.GITHUB_SHA ?? "").slice(0, 7);

const major_minor = version.split(".").slice(0, 2).join(".");

const lines = [];
lines.push(`# pkgring v${version}`);
lines.push("");
lines.push(`Released from \`${refName}\` at \`${sha}\`.`);

if (isPrerelease) {
  lines.push("");
  lines.push(
    `> **Note:** This is a release candidate. Install via the prerelease dist-tag: ` +
      `\`npm install @pkgring/core@rc\`. \`npm install @pkgring/core\` will continue to install the latest stable. ` +
      `Once the stable \`v${major_minor}.x\` ships, switch back via \`npm install @pkgring/core\`.`
  );
} else if (!isLatest) {
  lines.push("");
  lines.push(
    `> **Note:** This is a release on the **${major_minor}.x** line. ` +
      `It is _not_ the latest version — \`npm install @pkgring/core\` will not pick this up. ` +
      `Pin to this line via \`@pkgring/core@release-${major_minor}\` if you need it.`
  );
}
lines.push("");

if (published.length > 0) {
  lines.push("## Packages");
  lines.push("");
  for (const pkg of published) {
    lines.push(`- \`${pkg.name}@${pkg.version}\``);
  }
  lines.push("");
}

// .app-notes/*.md from HEAD~1 are the notes consumed by this release.
// (The version PR atomically deletes them; HEAD~1 is the prev main commit
// that still has them.)
try {
  const appNotes = execSync("node scripts/aggregate-app-notes.mjs HEAD~1", {
    encoding: "utf8",
  });
  if (appNotes.trim()) {
    lines.push(appNotes.trimEnd());
    lines.push("");
  }
} catch {
  // best-effort: don't fail release notes if aggregation hiccups
}

lines.push("## Docker image");
lines.push("");
lines.push(`- \`ghcr.io/ericallam/pkgring-sandbox:v${version}\``);
if (isLatest) {
  lines.push(`- \`ghcr.io/ericallam/pkgring-sandbox:latest\` (this version)`);
}
// Prereleases do NOT update the :release-X.Y line tag; that tag tracks
// the highest stable on the line. Match what publish.yml actually pushed.
if (!isPrerelease) {
  lines.push(`- \`ghcr.io/ericallam/pkgring-sandbox:release-${major_minor}\` (line-pinned tag)`);
}
lines.push(`- [GHCR](https://github.com/ericallam/pkgring-sandbox/pkgs/container/pkgring-sandbox)`);
lines.push("");

lines.push("## Helm chart");
lines.push("");
lines.push("```bash");
lines.push(`helm upgrade --install pkgring \\`);
lines.push(`  oci://ghcr.io/ericallam/charts/pkgring \\`);
lines.push(`  --version "${version}"`);
lines.push("```");
lines.push("");

process.stdout.write(lines.join("\n"));
