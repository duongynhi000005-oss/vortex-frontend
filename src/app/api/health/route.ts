import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/buildInfo";

// Node runtime: process.uptime() is only meaningful on a long-lived server process.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public build metadata and process uptime only. Never add env values, hostnames
// or dependency details here; this endpoint is unauthenticated.
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: buildInfo.version,
      commit: buildInfo.commit,
      uptime: Math.floor(process.uptime()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
