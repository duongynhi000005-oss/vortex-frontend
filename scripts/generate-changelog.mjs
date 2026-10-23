#!/usr/bin/env node
/**
 * Changelog generator.
 *
 * Reads conventional-commit subjects since the latest git tag (or the whole
 * history when no tag exists) and inserts them as a new version section in
 * CHANGELOG.md, directly below the "Unreleased" heading.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs [version]
 *
 * The version defaults to the RELEASE_VERSION env var, then package.json.
 */

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");

const SECTIONS = [
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["perf", "Changed"],
  ["refactor", "Changed"],
  ["docs", "Documentation"],
];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function latestTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0"]);
  } catch {
    return null;
  }
}

const version =
  process.argv[2] ||
  process.env.RELEASE_VERSION ||
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const tag = latestTag();
const range = tag ? [`${tag}..HEAD`] : [];
const subjects = git(["log", ...range, "--no-merges", "--pretty=format:%s"])
  .split("\n")
  .filter(Boolean);

const grouped = new Map();
for (const subject of subjects) {
  const match = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject);
  if (!match) continue;
  const entry = SECTIONS.find(([type]) => type === match[1]);
  if (!entry) continue;
  const [, heading] = entry;
  if (!grouped.has(heading)) grouped.set(heading, []);
  grouped.get(heading).push(match[2]);
}

const date = new Date().toISOString().slice(0, 10);
let block = `## [${version}] — ${date}\n\n`;
if (grouped.size === 0) {
  block += "- No notable changes\n\n";
} else {
  for (const [heading, items] of grouped) {
    block += `### ${heading}\n\n${items.map((i) => `- ${i}`).join("\n")}\n\n`;
  }
}

const current = readFileSync(CHANGELOG, "utf8");
const marker = /^## \[Unreleased\][\s\S]*?(?=^## \[)/m;
if (!marker.test(current)) {
  console.error("CHANGELOG.md has no [Unreleased] section followed by a release");
  process.exit(1);
}
writeFileSync(CHANGELOG, current.replace(marker, (m) => `${m}${block}`));
console.log(`CHANGELOG.md updated for ${version}`);
