/** Heuristics for strings that look like XDR envelopes or signatures. */

// Base64 run long enough to be a transaction envelope or signature, not prose.
const BASE64_BLOB_RE = /^[A-Za-z0-9+/_-]{80,}={0,2}$/;
// Hex run long enough to be a signature (64 bytes = 128 hex chars).
const HEX_BLOB_RE = /^(?:0x)?[0-9a-fA-F]{128,}$/;

export function looksLikeSensitiveBlob(value: string): boolean {
  const v = value.trim();
  return BASE64_BLOB_RE.test(v) || HEX_BLOB_RE.test(v);
}
