#!/usr/bin/env node
/**
 * Single SSRF guard: src/lib/server/safeFetch.ts is the only sanctioned
 * private-IP blocklist. Fails if another src/ file builds its own (a net
 * BlockList, or hand-written private-range literals such as "192.168.").
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SANCTIONED = 'src/lib/server/safeFetch.ts';
const PATTERNS = [/\bnew\s+BlockList\b/, /startsWith\(\s*["'](?:10\.|192\.168\.|169\.254\.|127\.)/, /\(\s*1\[6-9\]\|2\\d\|3\[01\]\s*\)/];

export function findDuplicates(files, read = (f) => readFileSync(f, 'utf8')) {
  return files.filter(
    (f) => /^src\/.*\.(ts|tsx)$/.test(f) && f !== SANCTIONED && !/\.test\.tsx?$/.test(f) && PATTERNS.some((p) => p.test(read(f))),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const bad = findDuplicates(files);
  if (bad.length) {
    console.error(`Second private-IP blocklist found (use ${SANCTIONED}):\n${bad.map((f) => `  ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('check:single-ssrf-guard OK');
}
