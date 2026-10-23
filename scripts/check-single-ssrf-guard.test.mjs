import { describe, expect, it } from 'vitest';
import { findDuplicates } from './check-single-ssrf-guard.mjs';

const src = { 'src/a.ts': 'x.startsWith("10.")', 'src/b.ts': 'const a = 1', 'src/lib/server/safeFetch.ts': 'new BlockList()' };

describe('check-single-ssrf-guard', () => {
  it('flags a second blocklist but not safeFetch or clean files', () => {
    expect(findDuplicates(Object.keys(src), (f) => src[f])).toEqual(['src/a.ts']);
  });
});
