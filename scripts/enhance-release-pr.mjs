#!/usr/bin/env node
// Enhances the changesets-generated release PR body with branch context.
//
// Inputs (env):
//   PR_NUMBER       — the version PR number
//   SOURCE_BRANCH   — the branch the release is being prepared on (main or release/X.Y.x)
//   NEW_VERSION     — the version proposed by the changesets bump
//   GH_TOKEN        — gh-cli token
//
// Behavior:
//   - Sets PR title to "chore: release v<version>"
//   - Prepends a header to the PR body explaining the branch context
//   - For release/* branches, calls out whether this is a lagged-line hotfix
//     by comparing against the current npm latest.
//
// Mirrors the spirit of trigger.dev's enhance-release-pr.mjs but adapted
// for the dual main/release-branch flow.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const prNumber = process.env.PR_NUMBER;
const sourceBranch = process.env.SOURCE_BRANCH;
const newVersion = process.env.NEW_VERSION;

if (!prNumber || !sourceBranch || !newVersion) {
  console.error("usage: PR_NUMBER, SOURCE_BRANCH, NEW_VERSION required (env)");
  process.exit(1);
}

const repo = "ericallam/pkgring-sandbox";

const isHotfix = sourceBranch.startsWith("release/");
const lineMatch = sourceBranch.match(/^release\/(\d+\.\d+)\.x$/);
const linePrefix = lineMatch ? lineMatch[1] : null;

// Compare to current npm latest to predict whether this will become :latest.
let currentLatest = "0.0.0";
try {
  currentLatest = execSync(`npm view @pkgring/core dist-tags.latest 2>/dev/null`, {
    encoding: "utf8",
  }).trim() || "0.0.0";
} catch {
  // package may not exist yet
}

const willBeLatest = (() => {
  const higher = execSync(
    `printf '%s\\n%s\\n' "${newVersion}" "${currentLatest}" | sort -V | tail -1`,
    { encoding: "utf8", shell: "/bin/bash" }
  ).trim();
  return higher === newVersion && newVersion !== currentLatest;
})();

const header = [];
header.push(`## Release prep`);
header.push("");
header.push(`- **Version:** \`${newVersion}\``);
header.push(`- **Source branch:** \`${sourceBranch}\``);
header.push(`- **Current \`latest\` on npm:** \`${currentLatest}\``);
header.push(
  `- **This release will become \`latest\`:** ${willBeLatest ? "✅ yes" : "❌ no — will publish to dist-tag `release-" + (linePrefix || "?") + "`"}`
);

if (isHotfix) {
  header.push("");
  header.push(`> Hotfix on the **${linePrefix}.x** line.`);
  if (willBeLatest) {
    header.push(
      `> Becomes \`latest\` because the current latest (${currentLatest}) is older. ` +
        `Customers running \`npm install\` will pick this up.`
    );
  } else {
    header.push(
      `> Will NOT become \`latest\` because main has shipped a higher version (${currentLatest}). ` +
        `Customers wanting this fix on the ${linePrefix}.x line should pin: ` +
        `\`npm install @pkgring/core@release-${linePrefix}\`.`
    );
  }
}
header.push("");
header.push("---");
header.push("");

// Fetch current body
const currentBody = execSync(
  `gh pr view ${prNumber} --repo ${repo} --json body --jq '.body'`,
  { encoding: "utf8" }
).trim();

// Strip any prior enhancement (look for our delimiter)
const stripped = currentBody.includes("---") && currentBody.startsWith("## Release prep")
  ? currentBody.split("\n---\n").slice(1).join("\n---\n").trimStart()
  : currentBody;

const newBody = header.join("\n") + stripped;
const newTitle = `chore: release v${newVersion}`;

// Update title + body via the API in one call. gh pr edit can flake on the
// classic-Projects deprecation, so go direct.
const tmpFile = "/tmp/pr-body.md";
writeFileSync(tmpFile, newBody);
execSync(
  `gh api repos/${repo}/pulls/${prNumber} -X PATCH -f title="${newTitle.replace(/"/g, '\\"')}" -F body=@${tmpFile}`,
  { stdio: "inherit" }
);

console.log(`Enhanced PR #${prNumber}: title="${newTitle}", branch=${sourceBranch}, willBeLatest=${willBeLatest}`);
