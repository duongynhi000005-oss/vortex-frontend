import { NextResponse } from "next/server";
import { ISSUE_PR_REVALIDATE_SECONDS, getIssuePrLinks, parseIssueIds } from "@/lib/issuePrLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = parseIssueIds(new URL(request.url).searchParams.get("ids"));
  const links = await getIssuePrLinks(ids);
  return NextResponse.json(
    { links },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${ISSUE_PR_REVALIDATE_SECONDS}, stale-while-revalidate=86400, stale-if-error=86400`,
      },
    },
  );
}
