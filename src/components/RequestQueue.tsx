'use client';

import { useState } from 'react';
import { RequestDetail } from './RequestDetail';
import { KIND_LABEL, STATUS_LABEL, isClosed } from '@/lib/requests';
import type { CivicRequest, MemberRole, Workspace, WorkspaceMember } from '@/lib/schemas';
import type { HandlerActor, Services } from '@/services/ports';

/**
 * The work queue of one workspace: requests that reached it, newest first, with
 * the same detail the person sees plus the controls their role allows.
 */
export function RequestQueue({
  requests,
  workspace,
  roleLabels,
  members,
  actor,
  services,
  onChanged,
}: {
  requests: CivicRequest[];
  workspace: Workspace;
  roleLabels: Record<MemberRole, string>;
  members: WorkspaceMember[];
  actor: HandlerActor;
  services: Services;
  onChanged: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected = requests.find((r) => r.id === picked) ?? requests[0] ?? null;
  const open = requests.filter((r) => !isClosed(r.status)).length;

  return (
    <section aria-label="Requests">
      <h2>Requests</h2>
      <p className="muted">
        Work queue for {workspace.name}: {open} open, {requests.length - open} closed. Requests arrive from the report form
        (issues) and the Marketplace (address requests). The same record, status and messages are what the person sees in Messages.
      </p>
      {requests.length === 0 ? (
        <p className="notice">
          Nothing in the queue yet. File an issue at /issues/report (for the BIA) or press Request address on an offer in the Marketplace (for a business).
        </p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {requests.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`pill${r.id === selected?.id ? ' active' : ''}`}
                  aria-pressed={r.id === selected?.id}
                  onClick={() => setPicked(r.id)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {r.title} · {KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status]}
                  {r.assignee ? ` · ${r.assignee.name}` : ' · unassigned'}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <RequestDetail
              request={selected}
              workspace={workspace}
              roleLabels={roleLabels}
              viewer={{ side: 'handler', actor, members }}
              services={services}
              onChanged={onChanged}
            />
          )}
        </>
      )}
    </section>
  );
}
