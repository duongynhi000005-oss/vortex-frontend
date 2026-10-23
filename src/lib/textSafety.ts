/** Removes control characters and markup delimiters from user-authored copy. */
export function sanitizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

/** Small homoglyph skeleton used by address-label phishing checks. */
export function confusableSkeleton(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[аɑ]/g, "a")
    .replace(/[еε]/g, "e")
    .replace(/[іı]/g, "i")
    .replace(/[оο]/g, "o")
    .replace(/[рρ]/g, "p")
    .replace(/[сϲ]/g, "c")
    .replace(/[хχ]/g, "x")
    .replace(/[^a-z0-9]/g, "");
}

/** Detects labels that combine Latin, Cyrillic and/or Greek characters. */
export function hasMixedScripts(value: string): boolean {
  const scripts = [/[A-Za-z]/.test(value), /[\u0400-\u04ff]/.test(value), /[\u0370-\u03ff]/.test(value)];
  return scripts.filter(Boolean).length > 1;
}

const BIDI_CONTROLS_RE = /[\u202A-\u202E\u2066-\u2069]/g;
const ZERO_WIDTH_INVIS_RE = /[\u200B-\u200D\uFEFF\u00AD]/g;

export function sanitizeDisplayText(value: string): string {
  return value.replace(BIDI_CONTROLS_RE, "").replace(ZERO_WIDTH_INVIS_RE, "");
}
