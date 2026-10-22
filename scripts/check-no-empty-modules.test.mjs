import { describe, expect, it } from 'vitest';
import { findProblems } from './check-no-empty-modules.mjs';

const root = 'scripts/fixtures/no-empty-modules';
const files = ['src/empty.ts', 'src/noexport.ts', 'src/valid.ts'];

describe('check-no-empty-modules', () => {
  it('flags empty and no-export files only', () => {
    const problems = findProblems(files, root, new Set());
    expect(problems).toEqual(['src/empty.ts: zero-byte module', 'src/noexport.ts: no export statement']);
  });
  it('honours the allowlist', () => {
    expect(findProblems(files, root, new Set(['src/empty.ts', 'src/noexport.ts']))).toEqual([]);
  });
});
