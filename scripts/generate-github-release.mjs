#!/usr/bin/env node
// Renders the GitHub release body. Inputs:
//   argv[2] = unified version (e.g. "1.2.3")
//   argv[3] = JSON string of publishedPackages (changesets/action output)
//
// Output: markdown to stdout.

const version = process.argv[2];
const publishedJson = process.argv[3] ?? "[]";

if (!version) {
  console.error("usage: generate-github-release.mjs <version> <publishedPackagesJson>");
  process.exit(1);
}

let published = [];
try {
  published = JSON.parse(publishedJson);
} catch {
  published = [];
}

const lines = [];
lines.push(`# pkgring v${version}`);
lines.push("");
lines.push(`Released from \`${process.env.GITHUB_REF_NAME ?? "(unknown ref)"}\` at \`${(process.env.GITHUB_SHA ?? "").slice(0, 7)}\`.`);
lines.push("");

if (published.length > 0) {
  lines.push("## Packages");
  lines.push("");
  for (const pkg of published) {
    lines.push(`- \`${pkg.name}@${pkg.version}\``);
  }
  lines.push("");
}

lines.push("## Docker image");
lines.push("");
lines.push(`- \`ghcr.io/triggerdotdev/pkgring-sandbox:v${version}\``);
lines.push(`- [GHCR](https://github.com/triggerdotdev/pkgring-sandbox/pkgs/container/pkgring-sandbox)`);
lines.push("");

lines.push("## Helm chart");
lines.push("");
lines.push("```bash");
lines.push(`helm upgrade --install pkgring \\`);
lines.push(`  oci://ghcr.io/triggerdotdev/charts/pkgring \\`);
lines.push(`  --version "${version}"`);
lines.push("```");
lines.push("");

process.stdout.write(lines.join("\n"));
