/**
 * Build metadata injected by next.config.mjs (version from package.json, commit
 * from Vercel/GitHub Actions, build time). Not user configuration, so it lives
 * here rather than in config.ts. Each name is read literally so Next can inline
 * it into both the browser and server bundles.
 */
export const buildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
  commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "unknown",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown",
} as const;
