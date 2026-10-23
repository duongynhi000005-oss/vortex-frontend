import type { NextRequest } from "next/server";

/**
 * Client IP used to key rate limits. Trust assumption: `x-forwarded-for` is
 * set reliably by the edge (Vercel overwrites it); behind an untrusted proxy
 * a client could spoof it and evade per-IP limits.
 */
export function clientIp(req: Pick<NextRequest, "headers" | "ip">): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
}
