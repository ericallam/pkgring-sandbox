#!/usr/bin/env node
// Reads .app-notes/*.md files from a given git ref and emits markdown.
//
// Usage:
//   node scripts/aggregate-app-notes.mjs <ref>
//
// <ref> is any git ref (commit, branch, tag) — typically HEAD~1 (the parent
// of the current release commit, where the consumed app-notes still live
// before they were deleted in the version PR). Falls back to gracefully
// emitting nothing if the ref doesn't exist or has no .app-notes/.

import { execSync } from "node:child_process";

const ref = process.argv[2] ?? "HEAD~1";

let files = "";
try {
  files = execSync(`git ls-tree -r --name-only ${ref} -- .app-notes/ 2>/dev/null`, {
    encoding: "utf8",
  });
} catch {
  // ref doesn't exist (e.g. shallow clone, very first release)
  process.exit(0);
}

const notePaths = files
  .split("\n")
  .filter((f) => f && f.endsWith(".md") && !f.endsWith("README.md"));

if (notePaths.length === 0) {
  process.exit(0);
}

const notes = notePaths
  .map((p) => {
    try {
      const body = execSync(`git show ${ref}:${p}`, { encoding: "utf8" }).trim();
      return body;
    } catch {
      return "";
    }
  })
  .filter(Boolean);

if (notes.length === 0) {
  process.exit(0);
}

console.log("## App changes");
console.log("");
for (const note of notes) {
  // Each note's first non-empty line becomes the bullet body.
  const firstLine = note.split("\n").find((l) => l.trim().length > 0) ?? "";
  console.log(`- ${firstLine.trim()}`);
}
console.log("");
