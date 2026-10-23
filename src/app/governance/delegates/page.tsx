'use client';

import { Suspense, useEffect, useState } from 'react';
import { useDelegation } from '@/hooks/useDelegation';
import { useQueryState } from '@/hooks/useQueryState';
import { sanitizeText } from '@/lib/textSafety';
import { isSameStellarAddress, isValidStellarAddress } from '@/lib/stellarAddress';

type SortKey = 'votingPower' | 'participationRate' | 'proposalsVoted';
const SORT_KEYS: SortKey[] = ['votingPower', 'participationRate', 'proposalsVoted'];
const DEFAULT_SORT_KEY: SortKey = 'votingPower';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function parseSortKey(value: string | null): SortKey {
  return SORT_KEYS.find((key) => key === value) ?? DEFAULT_SORT_KEY;
}

function DelegatesPageContent() {
  const {
    state: { currentDelegate, delegatedPower, history },
    flow,
    directory,
    effectiveVotingPower,
    startDelegate,
    startRevoke,
    confirm,
    cancel,
    searchDirectory,
    sortDirectory,
  } = useDelegation();
  const { params, update } = useQueryState();

  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(params.get('sort')));
  const [manualAddress, setManualAddress] = useState('');
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = params.get('q') ?? '';
    const nextSort = parseSortKey(params.get('sort'));
    setSearch(q);
    setSortKey(nextSort);
    searchDirectory(q);
    sortDirectory(nextSort);
  }, [params, searchDirectory, sortDirectory]);

  const targetAddress = manualAddress.trim();
  const isNewAddress = !directory.some((d) => isSameStellarAddress(d.address, targetAddress));
  const isRevoke = flow.target !== null && flow.target === currentDelegate;
  const progressLabel =
    flow.status === 'simulating'
      ? 'Simulating…'
      : flow.status === 'signing'
        ? 'Waiting for signature…'
        : flow.status === 'pending'
          ? 'Waiting for confirmation…'
          : null;

  const resetFlow = () => {
    setError(null);
    setConfirmedAddress('');
    cancel();
  };

  const handleReview = () => {
    setError(null);
    if (!isValidStellarAddress(targetAddress)) {
      setError('Enter a valid Stellar address.');
      return;
    }
    if (isSameStellarAddress(targetAddress, currentDelegate ?? '')) {
      setError('You cannot delegate to your current delegate.');
      return;
    }
    if (isNewAddress && confirmedAddress.trim() !== targetAddress) {
      setError('Confirm the full address before continuing.');
      return;
    }
    startDelegate(targetAddress);
  };

  const message =
    error ??
    (flow.status === 'review' && flow.isSelfDelegation
      ? 'You cannot delegate to your own account.'
      : flow.status === 'error'
        ? 'Delegation failed. Please try again.'
        : null);

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Voting delegation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Delegate your voting power to a trusted address. Delegation is revocable at any time and
        applies to future proposals only.
      </p>

      <section aria-labelledby="delegation-panel" className="mt-8 rounded-lg border p-4">
        <h2 id="delegation-panel" className="text-lg font-medium">
          Your delegation
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Current delegate</dt>
            <dd className="font-mono text-sm break-all">{currentDelegate ?? 'None'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Power delegated</dt>
            <dd className="text-sm">{delegatedPower}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Effective voting power</dt>
            <dd className="text-sm">{effectiveVotingPower}</dd>
          </div>
        </dl>

        {currentDelegate && (
          <button
            type="button"
            onClick={() => startRevoke()}
            disabled={progressLabel !== null}
            className="mt-4 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
          >
            {progressLabel !== null ? 'Revoking…' : 'Revoke delegation'}
          </button>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium">History</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span className="font-mono break-all">
                    {entry.action === 'revoke' ? 'Revoked' : entry.delegate}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="delegate-directory" className="mt-8">
        <h2 id="delegate-directory" className="text-lg font-medium">
          Delegate directory
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Search delegates</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                searchDirectory(e.target.value);
                update({ q: e.target.value || null });
              }}
              placeholder="Search by name or address"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">Sort delegates</span>
            <select
              value={sortKey}
              onChange={(e) => {
                const next = parseSortKey(e.target.value);
                setSortKey(next);
                sortDirectory(next);
                update({ sort: next === DEFAULT_SORT_KEY ? null : next });
              }}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="votingPower">Voting power</option>
              <option value="participationRate">Participation rate</option>
              <option value="proposalsVoted">Proposals voted</option>
            </select>
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {directory.map((d) => (
            <li key={d.address} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{sanitizeText(d.name)}</p>
                  <p className="font-mono text-xs break-all text-muted-foreground">{d.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManualAddress(d.address);
                    resetFlow();
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2"
                >
                  Delegate
                </button>
              </div>
              <p className="mt-2 text-sm">{sanitizeText(d.bio)}</p>
              <dl className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  <dt className="inline">Power: </dt>
                  <dd className="inline">{d.votingPower}</dd>
                </div>
                <div>
                  <dt className="inline">Participation: </dt>
                  <dd className="inline">{formatPercent(d.participationRate)}</dd>
                </div>
                <div>
                  <dt className="inline">Proposals voted: </dt>
                  <dd className="inline">{d.proposalsVoted}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="delegate-form" className="mt-8 rounded-lg border p-4">
        <h2 id="delegate-form" className="text-lg font-medium">
          Delegate to an address
        </h2>
        <label className="mt-3 block">
          <span className="text-sm">Address</span>
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => {
              setManualAddress(e.target.value);
              resetFlow();
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>

        {isNewAddress && targetAddress && (
          <label className="mt-3 block">
            <span className="text-sm">
              Confirm the full address (address-poisoning defence)
            </span>
            <input
              type="text"
              value={confirmedAddress}
              onChange={(e) => setConfirmedAddress(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
            />
          </label>
        )}

        {message && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {message}
          </p>
        )}

        {(flow.status === 'idle' || flow.status === 'error') && (
          <button
            type="button"
            onClick={handleReview}
            className="mt-4 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
          >
            Review delegation
          </button>
        )}

        {flow.status === 'review' && (
          <div className="mt-4 rounded-md border p-3 text-sm">
            <p>
              {isRevoke ? (
                'You are revoking your delegation. Revocation applies to future proposals only.'
              ) : (
                <>
                  You are delegating your voting power to{' '}
                  <span className="font-mono break-all">{flow.target}</span>. Delegation is
                  revocable and applies to future proposals only.
                </>
              )}
            </p>
            {!flow.isSelfDelegation && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void confirm()}
                  className="rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
                >
                  {isRevoke ? 'Confirm revoke' : 'Confirm delegation'}
                </button>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {progressLabel !== null && (
          <p className="mt-4 text-sm" role="status">
            {progressLabel}
          </p>
        )}

        {flow.status === 'confirmed' && (
          <p className="mt-4 text-sm" role="status">
            Delegation updated. Effective voting power refreshed.
          </p>
        )}
      </section>
    </main>
  );
}

export default function DelegatesPage() {
  return (
    <Suspense fallback={null}>
      <DelegatesPageContent />
    </Suspense>
  );
}
