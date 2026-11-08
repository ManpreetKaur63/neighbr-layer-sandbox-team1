'use client';

import { useState } from 'react';
import Link from 'next/link';
import { decide } from '@/lib/permissions';
import {
  ACTION_LABEL,
  HANDLER_FROM,
  KIND_LABEL,
  STATUS_LABEL,
  accessLines,
  isClosed,
  type HandlerAction,
} from '@/lib/requests';
import { mapHref } from '@/lib/workspace';
import type { CivicRequest, MemberRole, Workspace, WorkspaceMember } from '@/lib/schemas';
import type { HandlerActor, Services } from '@/services/ports';

export type RequestViewer =
  | { side: 'resident' }
  | { side: 'handler'; actor: HandlerActor; members: WorkspaceMember[] };

const when = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 16)} UTC`;

/** What the current status means, in words for the side that is reading. */
function statusExplanation(request: CivicRequest, side: RequestViewer['side']): string {
  const mine = side === 'resident';
  switch (request.status) {
    case 'submitted':
      return mine
        ? 'Your request has been sent. Nobody has started on it yet.'
        : 'New. Assign it to someone or start the review.';
    case 'in-review':
      return mine
        ? `The team is working on it${request.assignee ? `, assigned to ${request.assignee.name}` : ''}.`
        : `In review${request.assignee ? `, assigned to ${request.assignee.name}` : ', not assigned yet'}.`;
    case 'needs-info':
      return mine
        ? 'The team needs more information from you. Read their question below and reply.'
        : 'Waiting for the person to reply. It returns to review when they do.';
    case 'declined':
      return mine
        ? 'The team declined this request. Read the reason below. If it is still a problem, follow up.'
        : 'Declined. The person can follow up to reopen it.';
    case 'resolved':
      return mine
        ? 'The team marked this resolved. If it is still a problem, follow up.'
        : 'Resolved. The person can follow up if it is not fixed.';
  }
}

/**
 * One request, shown to the person who submitted it or to the organization that
 * handles it. Both see the same status, record of what happened, messages and
 * "who can view or change" lines; only the controls differ. Every control the
 * viewer may not use is disabled and says why, and the service rejects it anyway.
 */
export function RequestDetail({
  request,
  workspace,
  roleLabels,
  viewer,
  services,
  onChanged,
}: {
  request: CivicRequest;
  workspace: Workspace;
  roleLabels: Record<MemberRole, string>;
  viewer: RequestViewer;
  services: Services;
  onChanged: () => void | Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string, clear: () => void) {
    setNotice(null);
    setError(null);
    try {
      await fn();
      clear();
      await onChanged();
      setNotice(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  }

  const isHandler = viewer.side === 'handler';
  const decision = isHandler ? decide('work', viewer.actor, workspace.status) : null;
  const canAct = decision ? decision.allowed && workspace.status !== 'restricted' : false;
  const assignable = isHandler ? viewer.members.filter((m) => m.status === 'active' && m.role !== 'member') : [];
  const closed = isClosed(request.status);

  const handle = (action: HandlerAction, ok: string, withNote = false) => {
    if (!isHandler) return;
    return run(
      () =>
        services.requests.handle(
          request.id,
          { action, note: withNote ? note : undefined, assigneeId: action === 'assign' ? assigneeId : undefined },
          viewer.actor,
        ),
      ok,
      () => setNote(''),
    );
  };
  const available = (action: HandlerAction) => canAct && HANDLER_FROM[action].includes(request.status);

  return (
    <article className="card" aria-label={`Request: ${request.title}`}>
      <h2 style={{ marginTop: 0 }}>{request.title}</h2>
      <div className="pill-row">
        <span className="pill">{KIND_LABEL[request.kind]}</span>
        <span className="pill active">{STATUS_LABEL[request.status]}</span>
        <span className="pill">Handled by {workspace.name}</span>
        {request.assignee && <span className="pill">Assigned to {request.assignee.name}</span>}
      </div>
      <p role="status">{statusExplanation(request, viewer.side)}</p>
      {request.summary && <p className="muted">“{request.summary}”</p>}
      {request.objectId && (
        <p>
          <Link href={mapHref(request.objectId)}>📍 View on map</Link>
        </p>
      )}

      <section aria-label="Who can view or change this request">
        <h3>Who can view or change this request</h3>
        <ul>
          {accessLines(request, workspace.name, roleLabels, workspace.status).map((l) => (
            <li key={l.who}>
              <strong>{l.who}:</strong> {l.can}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Record of what happened">
        <h3>Record of what happened</h3>
        <ol>
          {request.history.map((ev) => (
            <li key={ev.id}>
              <strong>{ACTION_LABEL[ev.action]}</strong> · {ev.actor} · <span className="muted">{when(ev.at)}</span>
              {ev.note && <div className="muted">{ev.note}</div>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Messages">
        <h3>Messages</h3>
        {request.messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          request.messages.map((m) => (
            <p key={m.id} style={{ margin: '0 0 8px' }}>
              <strong>{m.author}</strong> <span className="muted">({m.from === 'resident' ? 'person' : 'team'} · {when(m.at)})</span>
              <br />
              {m.text}
            </p>
          ))
        )}
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}

      {viewer.side === 'resident' && (
        <section aria-label="Your reply">
          <h3>{closed ? 'Follow up' : 'Reply'}</h3>
          <label htmlFor={`reply-${request.id}`} className="muted">
            {closed ? 'What is still wrong?' : request.status === 'needs-info' ? 'Your answer to the team' : 'Add a message for the team'}
          </label>
          <textarea
            id={`reply-${request.id}`}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
          />
          <div className="btn-row">
            {closed ? (
              <button type="button" className="btn" onClick={() => run(() => services.requests.reopen(request.id, text), 'Follow-up sent. The request is back in review.', () => setText(''))}>
                Follow up
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => run(() => services.requests.reply(request.id, text), 'Reply sent.', () => setText(''))}>
                Send reply
              </button>
            )}
          </div>
        </section>
      )}

      {viewer.side === 'handler' && decision && (
        <section aria-label="Handle this request">
          <h3>Handle this request</h3>
          <p className="muted">Acting as {viewer.actor.name} ({roleLabels[viewer.actor.role]}).</p>
          {!canAct && <p className="muted" role="note">Not available for this person: {workspace.status === 'restricted' ? 'This workspace is restricted, so it is read-only.' : decision.reason}</p>}
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <label>
              <span className="muted">Assign to: </span>
              <select
                aria-label="Assign to"
                value={assigneeId}
                disabled={!available('assign')}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}
              >
                <option value="">Choose a person</option>
                {assignable.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({roleLabels[m.role]})</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn secondary" disabled={!available('assign') || !assigneeId} onClick={() => handle('assign', 'Assigned.')}>
              Assign
            </button>
            <button type="button" className="btn secondary" disabled={!available('start-review')} onClick={() => handle('start-review', 'Review started.')}>
              Start review
            </button>
          </div>
          <label htmlFor={`note-${request.id}`} className="muted">Note to the person (required to ask a question, decline or resolve)</label>
          <textarea
            id={`note-${request.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
          />
          <div className="btn-row">
            <button type="button" className="btn secondary" disabled={!available('ask-info')} onClick={() => handle('ask-info', 'Question sent to the person.', true)}>
              Ask for more information
            </button>
            <button type="button" className="btn secondary" disabled={!available('decline')} onClick={() => handle('decline', 'Request declined.', true)}>
              Decline
            </button>
            <button type="button" className="btn" disabled={!available('resolve')} onClick={() => handle('resolve', 'Request resolved.', true)}>
              Resolve
            </button>
          </div>
          <p className="muted">Resolve is available once the request is in review. Decline and ask are available until it is closed.</p>
          <label htmlFor={`msg-${request.id}`} className="muted">Send a message</label>
          <textarea
            id={`msg-${request.id}`}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
          />
          <div className="btn-row">
            <button type="button" className="btn secondary" disabled={!canAct} onClick={() => run(() => services.requests.send(request.id, text, viewer.actor), 'Message sent.', () => setText(''))}>
              Send message
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
