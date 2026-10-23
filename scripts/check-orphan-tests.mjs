#!/usr/bin/env node

/**
 * Find test-like files in Vitest's source scope that do not match Vitest's
 * default test/spec filename convention. Playwright specs under e2e/ are
 * intentionally outside this check because they have their own runner.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRS = ["src", "scripts"];
const TEST_LIKE = /(^|[._-])(test|tests|spec|specs)([._-]|$)/i;
const VITEST_TEST = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i;

export function findOrphanTests(files) {
  return files.filter((file) => TEST_LIKE.test(path.basename(file)) && !VITEST_TEST.test(file));
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function main() {
  const root = process.cwd();
  const files = SOURCE_DIRS.flatMap((directory) => listFiles(path.join(root, directory)));
  const orphanTests = findOrphanTests(files);

  if (orphanTests.length > 0) {
    console.error("Test-like files use names Vitest will not discover:");
    for (const file of orphanTests) console.error(`  - ${path.relative(root, file).replaceAll("\\", "/")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Vitest test filenames are valid (${files.filter((file) => VITEST_TEST.test(file)).length} test files checked).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
