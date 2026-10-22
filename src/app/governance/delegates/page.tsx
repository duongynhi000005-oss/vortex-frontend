'use client';

import { useState } from 'react';
import { useDelegation, type DelegateProfile } from '@/hooks/useDelegation';
import { sanitizeText } from '@/lib/textSafety';
import { isValidStellarPublicKey } from '@/lib/stellarAddress';

type SortKey = 'votingPower' | 'participationRate' | 'proposalsVoted';

function formatPower(value: string): string {
  return value;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function DelegatesPage() {
  const {
    state,
    flow,
    directory,
    directoryLoading,
    directoryError,
    effectiveVotingPower,
    startDelegate,
    startRevoke,
    confirm,
    cancel,
    searchDirectory,
    sortDirectory,
  } = useDelegation();
  const { currentDelegate, delegatedPower, history } = state;

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('votingPower');
  const [manualAddress, setManualAddress] = useState('');
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isPending = flow.status === 'simulating' || flow.status === 'signing' || flow.status === 'pending';
  const target = flow.target ?? '';
  const error = localError ?? (flow.error ? 'Delegation failed. Please try again.' : null);

  const handleSelect = (d: DelegateProfile) => {
    setManualAddress('');
    setConfirmedAddress('');
    setLocalError(null);
    startDelegate(d.address);
  };

  const handleReview = () => {
    setLocalError(null);
    const address = manualAddress.trim();
    if (!isValidStellarPublicKey(address)) {
      setLocalError('Enter a valid Stellar address.');
      return;
    }
    startDelegate(address);
  };

  const handleConfirm = () => {
    setLocalError(null);
    if (flow.isSelfDelegation) {
      setLocalError('You cannot delegate to yourself.');
      return;
    }
    if (flow.requiresFullAddressConfirmation && confirmedAddress.trim() !== target) {
      setLocalError('Confirm the full address before continuing.');
      return;
    }
    void confirm();
  };

  const handleCancel = () => {
    setLocalError(null);
    setConfirmedAddress('');
    cancel();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
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
            <dd className="text-sm">{formatPower(delegatedPower)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Effective voting power</dt>
            <dd className="text-sm">{formatPower(effectiveVotingPower)}</dd>
          </div>
        </dl>

        {currentDelegate && (
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              startRevoke();
            }}
            disabled={isPending || flow.status === 'review'}
            className="mt-4 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
          >
            Revoke delegation
          </button>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium">History</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span className="font-mono break-all">{entry.action === 'revoke' ? 'Revoked' : entry.delegate}</span>
                  <span className="text-muted-foreground">{new Date(entry.timestamp).toISOString()}</span>
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
                const key = e.target.value as SortKey;
                setSortKey(key);
                sortDirectory(key);
              }}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="votingPower">Voting power</option>
              <option value="participationRate">Participation rate</option>
              <option value="proposalsVoted">Proposals voted</option>
            </select>
          </label>
        </div>

        {directoryLoading && (
          <p className="mt-4 text-sm" role="status">
            Loading delegates…
          </p>
        )}
        {directoryError && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            Delegate directory is unavailable.
          </p>
        )}
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
                  onClick={() => handleSelect(d)}
                  className="rounded-md border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2"
                >
                  Delegate
                </button>
              </div>
              <p className="mt-2 text-sm">{sanitizeText(d.bio)}</p>
              <dl className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  <dt className="inline">Power: </dt>
                  <dd className="inline">{formatPower(d.votingPower)}</dd>
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
            value={flow.status === 'idle' ? manualAddress : target}
            readOnly={flow.status !== 'idle'}
            onChange={(e) => setManualAddress(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>

        {flow.status === 'review' && flow.requiresFullAddressConfirmation && (
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

        {flow.status === 'review' && flow.isNonExistentAccount && (
          <p className="mt-3 text-sm text-amber-600">
            This address is not in the delegate directory and may have no voting history.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {flow.status === 'idle' && (
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
              You are {target === currentDelegate ? 'revoking delegation from' : 'delegating your voting power to'}{' '}
              <span className="font-mono break-all">{target}</span>. Delegation is revocable and
              applies to future proposals only.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              className="mt-3 rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
            >
              Simulate, sign &amp; confirm
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="ml-2 mt-3 rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
            >
              Cancel
            </button>
          </div>
        )}

        {isPending && (
          <p className="mt-4 text-sm" role="status">
            {flow.status === 'simulating' ? 'Simulating…' : 'Waiting for signature…'}
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
