'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { useServices } from '@/services/use-services';
import type { CivicObject } from '@/lib/schemas';

/**
 * Polls (M04): open polls with resident voting. Votes go through the
 * SocialPort; closed polls and unknown options are rejected (error-path proof).
 */
export function PollsClient() {
  const services = useServices();
  const [polls, setPolls] = useState<CivicObject[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    services.objects
      .list({ cityId: 'windsor', kinds: ['poll'] })
      .then((list) => {
        if (live) setPolls(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [services]);

  async function vote(poll: CivicObject, optionId: string) {
    setError(null);
    try {
      const updated = await services.social.vote(poll.id, optionId);
      setPolls((ps) => ps?.map((p) => (p.id === poll.id ? updated : p)) ?? null);
      setVoted((s) => new Set(s).add(poll.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your vote.');
    }
  }

  const state = failed ? 'error' : polls === null ? 'loading' : polls.length === 0 ? 'empty' : 'success';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Civic</p>
        <h1>Polls</h1>
        <p className="lede">
          Have your say — demo polls for Windsor residents. Voting is limited to verified residents in this demo.
        </p>
        <p>
          <Link className="btn secondary" href="/polls/create">
            Create a poll
          </Link>
        </p>
        {error && (
          <p role="alert" className="card">
            {error}
          </p>
        )}
        <StateBoundary
          state={state}
          loadingLabel="Loading polls…"
          emptyTitle="No polls right now"
          emptyHelp="There are no open polls in the demo data."
          errorTitle="Polls unavailable"
          errorHelp="Could not load polls. Try again."
          onRetry={() => {
            setFailed(false);
            setPolls(null);
          }}
        >
          {polls?.map((poll) => {
            const total = (poll.poll?.options ?? []).reduce((n, o) => n + o.votes, 0);
            const closed = poll.poll?.closed || poll.status !== 'Open';
            const hasVoted = voted.has(poll.id);
            return (
              <article className="card" key={poll.id} aria-label={`Poll: ${poll.title}`}>
                <span className="badge">{closed ? 'closed' : 'open'}</span>
                {poll.restrictedTo && <span className="muted"> · residents only</span>}
                <h3 style={{ margin: '8px 0 4px' }}>{poll.title}</h3>
                <p className="muted">{poll.summary}</p>
                {(poll.poll?.options ?? []).map((opt) => {
                  const pct = total === 0 ? 0 : Math.round((opt.votes / total) * 100);
                  return (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                      <button
                        type="button"
                        className="pill"
                        disabled={closed || hasVoted}
                        onClick={() => vote(poll, opt.id)}
                        aria-label={`Vote for ${opt.label}`}
                      >
                        {hasVoted ? '✓ ' : ''}{opt.label}
                      </button>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {opt.votes} votes ({pct}%)
                      </span>
                    </div>
                  );
                })}
                <p className="muted" style={{ fontSize: 13 }}>
                  {total} total votes · <Link href={`/map?sel=${poll.id}`}>📍 View on map</Link>
                </p>
                {hasVoted && <p className="badge ok">✓ Thanks — your vote was counted (demo).</p>}
              </article>
            );
          })}
        </StateBoundary>
        <p className="notice">Everything here is invented demo data.</p>
      </main>
    </>
  );
}
