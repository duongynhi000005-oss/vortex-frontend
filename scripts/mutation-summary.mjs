#!/usr/bin/env node
/**
 * Summarises Stryker mutation scores for files changed against a base ref
 * (see docs/testing.md, "Mutation Testing").
 *
 * Usage:
 *   node scripts/mutation-summary.mjs [base-ref] [path-to-report]
 *
 * Prints a Markdown table to stdout (used as the PR comment body) and exits
 * 1 when a changed file scores below its floor.
 *
 * Exit codes:
 *   0 — every changed file meets its floor (or none changed)
 *   1 — one or more changed files are below their floor
 */

import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

const BASE_REF = process.argv[2] || "origin/main";
const REPORT_PATH = resolve(
  process.argv[3] || join(ROOT, "reports/mutation/mutation.json")
);

// Security-critical modules hold a stricter floor than the 75% default.
const DEFAULT_FLOOR = 75;
const STRICT_FLOOR = 85;
const STRICT_MODULES = new Set([
  "src/lib/csv.ts",
  "src/lib/xdrReview.ts",
  "src/lib/textSafety.ts",
  "src/lib/decimal.ts",
]);

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

if (!existsSync(REPORT_PATH)) {
  console.log("⚠️ Mutation report was not generated; no scores to summarise.");
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

const changed = execFileSync(
  "git",
  ["diff", "--name-only", `${BASE_REF}...HEAD`, "--", "src/lib"],
  { cwd: ROOT, encoding: "utf8" }
)
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /\.tsx?$/.test(line))
  .filter((line) => !/\.(test|fuzz\.test)\.tsx?$/.test(line));

const rows = [];
let failed = false;

for (const file of changed) {
  const mutants = report.files?.[file]?.mutants;
  if (!mutants) {
    rows.push({ file, note: "not mutated" });
    continue;
  }
  const detected = mutants.filter((m) => DETECTED.has(m.status)).length;
  const undetected = mutants.filter((m) => UNDETECTED.has(m.status)).length;
  const valid = detected + undetected;
  const score = valid === 0 ? 100 : (detected / valid) * 100;
  const floor = STRICT_MODULES.has(file) ? STRICT_FLOOR : DEFAULT_FLOOR;
  const pass = score >= floor;
  if (!pass) failed = true;
  rows.push({ file, score, floor, killed: detected, survived: undetected, pass });
}

console.log("## Mutation score (changed `src/lib` files)\n");
if (rows.length === 0) {
  console.log("No changed `src/lib` source files in this PR.");
  process.exit(0);
}

console.log("| File | Score | Floor | Detected | Undetected | Status |");
console.log("| --- | ---: | ---: | ---: | ---: | --- |");
for (const row of rows) {
  if (row.note) {
    console.log(`| \`${row.file}\` | — | — | — | — | ${row.note} |`);
    continue;
  }
  const status = row.pass ? "✅ pass" : "❌ below floor";
  console.log(
    `| \`${row.file}\` | ${row.score.toFixed(1)}% | ${row.floor}% | ${row.killed} | ${row.survived} | ${status} |`
  );
}

process.exit(failed ? 1 : 0);
