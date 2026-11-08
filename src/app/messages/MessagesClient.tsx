'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { RequestDetail } from '@/components/RequestDetail';
import { createMockServices } from '@/services/mock';
import type { Services } from '@/services/ports';
import { KIND_LABEL, STATUS_LABEL } from '@/lib/requests';
import { KIND_CONFIG } from '@/lib/workspace-config';
import type { CivicRequest, Workspace } from '@/lib/schemas';

/**
 * Messages (M06): the person's side of the request journey. Every request they
 * submitted, its status, who is handling it, the record of what happened and the
 * conversation with the organization, with the replies and follow-up they are
 * allowed to send. Direct and group chats are not built yet.
 */
export function MessagesClient({ services: injected }: { services?: Services }) {
  const services = useMemo(() => injected ?? createMockServices(), [injected]);
  const params = useSearchParams();
  const wanted = params ? params.get('id') : null;

  const [requests, setRequests] = useState<CivicRequest[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [picked, setPicked] = useState<string | null>(wanted);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, all] = await Promise.all([services.requests.list({ mine: true }), services.workspaces.workspaces()]);
      setRequests(list);
      setWorkspaces(all);
    } catch {
      setFailed(true);
    }
  }, [services]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  const state = failed ? 'error' : requests === null ? 'loading' : requests.length === 0 ? 'empty' : 'success';
  const selected = requests?.find((r) => r.id === picked) ?? requests?.[0] ?? null;
  const workspace = selected ? workspaces.find((w) => w.id === selected.workspaceId) ?? null : null;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Community</p>
        <h1>Messages</h1>
        <p className="lede">
          Your requests and the replies from the organizations handling them: the status, who can see it, what happened and
          the conversation. Everything here is invented demo data.
        </p>
        <StateBoundary
          state={state}
          loadingLabel="Loading your requests…"
          emptyTitle="No requests yet"
          emptyHelp="Report an issue, or press Request address on a Marketplace offer. It shows up here with its status and the replies."
          errorTitle="Messages unavailable"
          errorHelp="Could not load your requests. Try again."
          onRetry={() => {
            setFailed(false);
            setRequests(null);
            void load();
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }} aria-label="Your requests">
            {requests?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`pill${r.id === selected?.id ? ' active' : ''}`}
                  aria-pressed={r.id === selected?.id}
                  onClick={() => setPicked(r.id)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {r.title} · {KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status]}
                </button>
              </li>
            ))}
          </ul>
          {selected && workspace && (
            <RequestDetail
              request={selected}
              workspace={workspace}
              roleLabels={KIND_CONFIG[workspace.kind].roleLabels}
              viewer={{ side: 'resident' }}
              services={services}
              onChanged={load}
            />
          )}
        </StateBoundary>
        <div className="btn-row">
          <Link className="btn" href="/issues/report">Report an issue</Link>
          <Link className="btn secondary" href="/marketplace">Open the Marketplace</Link>
        </div>
        <p className="notice">Direct and group chats are not built yet. This page carries the conversation for each request.</p>
      </main>
    </>
  );
}
