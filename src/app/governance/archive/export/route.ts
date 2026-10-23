import { getGovernanceProposals } from "@/lib/governanceStore";
import { buildArchiveCsv, type ArchiveSearchParams } from "@/lib/governanceArchive";

// `page.tsx` cannot set response headers, so the CSV download lives in a
// sibling route handler that shares the page's filter logic.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const params: ArchiveSearchParams = {};
  for (const key of ["status", "category", "from", "to", "q", "sort"] as const) {
    const value = sp.get(key);
    if (value !== null) params[key] = value;
  }
  return new Response(buildArchiveCsv(getGovernanceProposals(), params), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="governance-archive.csv"',
      "Cache-Control": "no-store",
    },
  });
}
