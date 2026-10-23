import type { Metadata } from 'next';
import Link from 'next/link';
import { bucketProposalsByMonth, getGovernanceProposals } from '@/lib/governanceStore';
import { BarChart } from '@/components/charts';
import { ProposalStatusChip } from '@/components/ProposalStatusChip';
import {
  ARCHIVE_STATUSES as STATUSES,
  filterArchiveProposals,
  parseStatus,
  type ArchiveSearchParams,
} from '@/lib/governanceArchive';

const PAGE_SIZE = 10;

function parsePage(value?: string): number {
  const n = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ArchiveSearchParams;
}): Promise<Metadata> {
  const status = parseStatus(searchParams.status);
  const title =
    status === 'all'
      ? 'Governance Archive'
      : `Governance Archive — ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  return {
    title,
    description:
      'Searchable archive of past governance proposals with outcomes, final tallies and execution status.',
    alternates: { canonical: '/governance/archive' },
  };
}

export default async function GovernanceArchivePage({
  searchParams,
}: {
  searchParams: ArchiveSearchParams;
}) {
  const status = parseStatus(searchParams.status);
  const category = searchParams.category?.trim() || 'all';
  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  const page = parsePage(searchParams.page);

  const filtered = filterArchiveProposals(getGovernanceProposals(), searchParams);

  const timeline = bucketProposalsByMonth(filtered);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const buildHref = (overrides: Partial<ArchiveSearchParams>): string => {
    const params = new URLSearchParams();
    const merged = { status, category, from: searchParams.from, to: searchParams.to, q: searchParams.q, sort, page: String(currentPage), ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== 'all' && !(key === 'page' && value === '1')) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/governance/archive?${qs}` : '/governance/archive';
  };

  // CSV is served by the sibling route handler (`export/route.ts`) and covers
  // every matching row (capped), not just the current page.
  const csvHref = buildHref({ page: '1' }).replace('/governance/archive', '/governance/archive/export');

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Governance Archive</h1>
          <p className="text-sm text-muted-foreground">
            Past proposals with outcomes, final tallies and execution status.
          </p>
        </div>
        <a
          href={csvHref}
          className="rounded border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
        >
          Export CSV
        </a>
      </header>

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            className="rounded border px-2 py-1"
            aria-label="Search proposals"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Status</span>
          <select name="status" defaultValue={status} className="rounded border px-2 py-1">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Category</span>
          <input
            type="text"
            name="category"
            defaultValue={category === 'all' ? '' : category}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>From</span>
          <input type="date" name="from" defaultValue={searchParams.from ?? ''} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>To</span>
          <input type="date" name="to" defaultValue={searchParams.to ?? ''} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Sort</span>
          <select name="sort" defaultValue={sort} className="rounded border px-2 py-1">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
          Apply filters
        </button>
      </form>

      {timeline.length > 0 ? (
        <BarChart
          series={timeline}
          title="Outcomes by month"
          summary="Archived proposals per month, stacked by outcome: passed, rejected, executed and expired."
          width={720}
          height={200}
          className="mb-6"
        />
      ) : (
        <p className="mb-6 rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No archived outcomes to chart for the selected filters.
        </p>
      )}

      {rows.length >= 2 && (
        <form action="/governance/compare" method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          {(['a', 'b'] as const).map((name, i) => (
            <label key={name} className="flex flex-col gap-1">
              Compare {i === 0 ? 'first' : 'second'} proposal
              <select name={name} defaultValue={rows[i]?.id} className="rounded border px-2 py-1">
                {rows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}: {p.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="submit" className="rounded border px-3 py-2 text-sm">
            Compare
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No proposals match the selected filters.
        </p>
      ) : (
        <ul className="divide-y rounded border">
          {rows.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/governance/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                  {p.title}
                </Link>
                <ProposalStatusChip status={p.status} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  <dt>For</dt>
                  <dd>{p.votesFor}</dd>
                </div>
                <div>
                  <dt>Against</dt>
                  <dd>{p.votesAgainst}</dd>
                </div>
                <div>
                  <dt>Abstain</dt>
                  <dd>{p.votesAbstain ?? 0}</dd>
                </div>
                <div>
                  <dt>Execution</dt>
                  <dd>{p.status === 'executed' ? 'Executed' : 'Not executed'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
        <Link
          href={buildHref({ page: String(Math.max(1, currentPage - 1)) })}
          aria-disabled={currentPage <= 1}
          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'underline'}
        >
          Previous
        </Link>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <Link
          href={buildHref({ page: String(Math.min(totalPages, currentPage + 1)) })}
          aria-disabled={currentPage >= totalPages}
          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'underline'}
        >
          Next
        </Link>
      </nav>
    </main>
  );
}
