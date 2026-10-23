#!/usr/bin/env node
/**
 * Empty-module guard: fails if a tracked src/**\/*.{ts,tsx} file is zero bytes
 * or has no `export` statement (a bad merge/restore can silently empty files).
 * Test files, .d.ts files and Next.js route/page/layout files are not checked
 * for the missing-export case only where they legitimately lack exports.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Known-empty files awaiting restoration (issues #61–#65 and sibling non-security
 * restoration issues). TIME-BOXED: this list must shrink to zero.
 */
export const ALLOWLIST = new Set(
  JSON.parse(readFileSync(path.join(process.cwd(), 'scripts', 'empty-modules-allowlist.json'), 'utf8')),
);

const SOURCE = /^src\/.*\.(ts|tsx)$/;
const EXEMPT_NO_EXPORT = /(\.d\.ts|\.test\.tsx?|\.spec\.tsx?)$/;
const EXPORT = /^\s*export\s/m;

export function findProblems(files, root = '.', allowlist = ALLOWLIST) {
  const problems = [];
  for (const file of files) {
    if (!SOURCE.test(file) || allowlist.has(file)) continue;
    const abs = path.join(root, file);
    let size;
    try {
      size = statSync(abs).size;
    } catch {
      continue;
    }
    if (size === 0) {
      problems.push(`${file}: zero-byte module`);
    } else if (!EXEMPT_NO_EXPORT.test(file) && !EXPORT.test(readFileSync(abs, 'utf8'))) {
      problems.push(`${file}: no export statement`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const problems = findProblems(files);
  if (problems.length) {
    console.error(`Empty/no-export modules found:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('check:no-empty-modules OK');
}
