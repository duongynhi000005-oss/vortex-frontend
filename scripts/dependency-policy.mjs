#!/usr/bin/env node

/**
 * Dependency update decision logic (see docs/dependency-policy.md).
 *
 * classifyUpdate(pkg, from, to, type) → "auto" | "review" | "block"
 *
 *   auto   — dev-only, minor/patch, stable: may be auto-merged once required checks pass.
 *   review — production, crypto/wallet-related, framework core, major, 0.x minor or prerelease:
 *            needs a human approval.
 *   block  — downgrade, unparseable version, or unknown dependency type: never merge automatically.
 *
 * This module is pure: no network, no filesystem. The auto-merge workflow runs it from the
 * trusted base branch and feeds it the output of `dependabot/fetch-metadata` as JSON on stdin,
 * so PR code is never executed in a `pull_request_target` context.
 *
 * Usage (CLI):
 *   echo '<updated-dependencies-json>' | node scripts/dependency-policy.mjs
 *   Prints { "decision": "...", "results": [...] } and always exits 0.
 */

import { readFileSync } from "fs";

// Packages whose updates can change signing, key handling or wallet behaviour.
// Any update to these is reviewed by a human regardless of dependency type or bump size.
const CRYPTO_RELATED_PATTERNS = [/^@stellar\//, /^next$/, /^react$/, /^react-dom$/];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const RANK = { auto: 0, review: 1, block: 2 };

export function isCryptoRelated(pkg) {
  return CRYPTO_RELATED_PATTERNS.some((pattern) => pattern.test(pkg));
}

function parseVersion(version) {
  const match = SEMVER.exec(String(version ?? "").trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * @param {string} pkg   package name, e.g. "vitest" or "@stellar/stellar-sdk"
 * @param {string} from  currently installed version
 * @param {string} to    proposed version
 * @param {"dev"|"prod"} type  dependency kind
 * @returns {"auto"|"review"|"block"}
 */
export function classifyUpdate(pkg, from, to, type) {
  if (type !== "dev" && type !== "prod") return "block";

  const before = parseVersion(from);
  const after = parseVersion(to);
  if (!before || !after) return "block";
  if (compareVersions(after, before) < 0) return "block";

  if (after.prerelease) return "review";
  if (isCryptoRelated(pkg)) return "review";
  if (type === "prod") return "review";
  if (after.major !== before.major) return "review";

  // Pre-1.0 minors are allowed to break; treat them like majors.
  if (before.major === 0 && after.minor !== before.minor) return "review";

  return "auto";
}

/**
 * Combines per-dependency decisions into a single decision for a PR.
 * An empty list is "block": there is nothing to justify the auto path.
 */
export function classifyUpdates(updates) {
  if (updates.length === 0) return "block";
  return updates.reduce(
    (worst, update) => {
      const decision = classifyUpdate(update.name, update.from, update.to, update.type);
      return RANK[decision] > RANK[worst] ? decision : worst;
    },
    "auto"
  );
}

// Maps dependabot/fetch-metadata `updated-dependencies-json` entries to the policy input.
// Indirect (transitive) dependencies are treated as production, the conservative choice.
function toUpdate(entry) {
  return {
    name: entry["dependency-name"],
    from: entry["previous-version"],
    to: entry["new-version"],
    type: String(entry["dependency-type"] ?? "").includes("development") ? "dev" : "prod",
  };
}

function main() {
  const input = readFileSync(0, "utf-8").trim();
  const entries = input ? JSON.parse(input) : [];
  const updates = entries.map(toUpdate);
  const results = updates.map((update) => ({
    dependency: update.name,
    from: update.from,
    to: update.to,
    type: update.type,
    decision: classifyUpdate(update.name, update.from, update.to, update.type),
  }));
  process.stdout.write(
    JSON.stringify({ decision: classifyUpdates(updates), results }, null, 2) + "\n"
  );
}

// Only run main() when this file is executed directly, not when imported as a module.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
