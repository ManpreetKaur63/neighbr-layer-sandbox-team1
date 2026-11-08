'use client';

import { useState } from 'react';
import type { Services } from '@/services/ports';
import type { Communication, PublicationState, Workspace } from '@/lib/schemas';
import {
  PUBLICATION_LABEL,
  decideApproval,
  decideCommStep,
  type GovActor,
} from '@/lib/governance';
import { decide } from '@/lib/permissions';
import { Feedback, PublicationTag, Tag, Why, fmtDate, useAct } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

type Filter = 'all' | PublicationState;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'in-review', label: 'In review' },
  { id: 'returned', label: 'Returned' },
  { id: 'published', label: 'Published' },
  { id: 'withdrawn', label: 'Withdrawn' },
];

/**
 * Public communications and their publication states: draft, in review, returned, published, withdrawn. Only
 * published items are public. Approving needs the approver role and a second person (four-eyes); the screen says
 * so and the port refuses and records an attempt to approve your own draft.
 */
export function CommsPanel({
  services,
  workspace,
  actor,
  initialCaseId,
}: {
  services: Services;
  workspace: Workspace;
  actor: GovActor;
  initialCaseId?: string | null;
}) {
  const { cases, comms, loaded, failed, reload } = useGovData(services, workspace);
  const { notice, error, busy, act } = useAct(reload);
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [caseId, setCaseId] = useState(initialCaseId ?? '');
  const isOffice = workspace.kind === 'office';

  if (failed) return <p role="alert">Could not load communications. Try again.</p>;
  if (!loaded) return <p role="status" aria-busy="true">Loading…</p>;

  const shown = filter === 'all' ? comms : comms.filter((m) => m.state === filter);
  const canCreate = decide('work', actor, workspace.status);
  const noun = isOffice ? 'Communications' : 'Responses';

  return (
    <section aria-label={noun}>
      <h2>{noun}</h2>
      <p className="muted">
        {isOffice
          ? 'Notices the office wants to publish. Each moves draft → in review → published, and nothing is public until a second person approves it.'
          : 'Responses to residents about routed cases. Each moves draft → in review → published, and nothing is public until the department manager, who did not write it, approves it.'}
      </p>
      <Feedback notice={notice} error={error} />

      <div className={styles.filters} role="group" aria-label="Filter by publication state">
        {FILTERS.map((f) => {
          const n = f.id === 'all' ? comms.length : comms.filter((m) => m.state === f.id).length;
          return (
            <button key={f.id} type="button" className={`pill ${filter === f.id ? 'active' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {shown.length === 0 && <p className="notice">Nothing in this state.</p>}
      {shown.map((m) => (
        <CommCard key={m.id} m={m} workspace={workspace} actor={actor} busy={busy} services={services} act={act} caseRef={cases.find((c) => c.id === m.caseId)?.reference} />
      ))}

      <details className="card" style={{ maxWidth: 'none' }} open={Boolean(initialCaseId)}>
        <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}>
          {isOffice ? 'Write a draft notice' : 'Write a draft response'}
        </summary>
        <div className={styles.form} style={{ marginTop: 10 }}>
          <p className="muted" style={{ margin: 0 }}>
            A draft is internal. It becomes public only after review and approval. Invented text only.
          </p>
          <label className={styles.fieldLabel}>
            Title
            <input className={styles.field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Draft title" />
          </label>
          <label className={styles.fieldLabel}>
            <span>
              Text <span className={styles.count}>({body.length}/1000)</span>
            </span>
            <textarea className={styles.field} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} aria-label="Draft text" />
          </label>
          <label className={styles.fieldLabel}>
            Answers a case
            <select className={styles.field} value={caseId} onChange={(e) => setCaseId(e.target.value)} aria-label="Case this answers">
              <option value="">{isOffice ? 'None: a general notice' : 'None: a general notice'}</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} · {c.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={busy || !canCreate.allowed}
            onClick={async () => {
              const ok = await act(
                () => services.governance.createCommunication({ workspaceId: workspace.id, title, body, ...(caseId ? { caseId } : {}) }, actor),
                'Draft created. It is internal until it is reviewed and approved.',
              );
              if (ok) {
                setTitle('');
                setBody('');
                setCaseId('');
              }
            }}
          >
            Create draft
          </button>
          {!canCreate.allowed && <Why>Not available for this person: {canCreate.reason}</Why>}
        </div>
      </details>
    </section>
  );
}

function CommCard({
  m,
  workspace,
  actor,
  busy,
  services,
  act,
  caseRef,
}: {
  m: Communication;
  workspace: Workspace;
  actor: GovActor;
  busy: boolean;
  services: Services;
  act: (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;
  caseRef: string | undefined;
}) {
  const [note, setNote] = useState('');
  const submit = decideCommStep('submit', actor, m, workspace);
  const approve = decideApproval(actor, m, workspace);
  const ret = decideCommStep('return', actor, m, workspace);
  const withdraw = decideCommStep('withdraw', actor, m, workspace);
  const step = (s: 'submit' | 'approve' | 'return' | 'withdraw', ok: string) =>
    act(() => services.governance.communicationStep(m.id, s, actor, note), ok).then((done) => {
      if (done) setNote('');
    });

  // The author who is also an approver gets a button that is allowed to be pressed: the service refuses it and records it.
  const tryOwn = approve.kind === 'author';

  return (
    <article className="card" style={{ maxWidth: 'none' }} aria-label={m.title}>
      <div className={styles.tags}>
        <PublicationTag state={m.state} />
        <Tag>{m.kind === 'response' ? `Response${caseRef ? ` to ${caseRef}` : ''}` : 'Notice'}</Tag>
      </div>
      <h3 style={{ margin: '8px 0 4px' }}>{m.title}</h3>
      <p style={{ margin: '0 0 6px', maxWidth: 'none' }}>{m.body}</p>
      <p className="muted" style={{ margin: '0 0 6px' }}>
        Written by {m.authorName} · updated {fmtDate(m.updatedAt)} · {PUBLICATION_LABEL[m.state]}
      </p>
      {m.reviewNote && (
        <p className="notice" style={{ margin: '0 0 8px' }}>
          {m.reviewerName ? `${m.reviewerName}: ` : ''}
          {m.reviewNote}
        </p>
      )}

      {(m.state === 'draft' || m.state === 'returned') && (
        <div className={styles.buttons}>
          <button type="button" className="btn" disabled={busy || !submit.allowed} onClick={() => step('submit', 'Submitted for review. Nobody outside the workspace can see it.')}>
            Submit for review
          </button>
        </div>
      )}
      {m.state === 'in-review' && (
        <div className={styles.actions}>
          <label className={styles.fieldLabel}>
            <span>
              Reviewer note <span className={styles.count}>(required to return)</span>
            </span>
            <textarea className={styles.field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label={`Reviewer note for ${m.title}`} />
          </label>
          <div className={styles.buttons}>
            <button
              type="button"
              className="btn"
              disabled={busy || (!approve.allowed && !tryOwn)}
              onClick={() => step('approve', 'Approved and published. It is public now.')}
            >
              {tryOwn ? 'Try to approve my own draft' : 'Approve and publish'}
            </button>
            <button type="button" className="btn secondary" disabled={busy || !ret.allowed} onClick={() => step('return', 'Returned to the author for changes.')}>
              Return for changes
            </button>
          </div>
          {!approve.allowed && <Why>{tryOwn ? `${approve.reason} Pressing the button will be refused and recorded.` : `Approval not available for this person: ${approve.reason}`}</Why>}
          {!ret.allowed && <Why>Returning is not available for this person: {ret.reason}</Why>}
        </div>
      )}
      {m.state === 'published' && (
        <div className={styles.actions}>
          <label className={styles.fieldLabel}>
            <span>
              Reason <span className={styles.count}>(required to withdraw)</span>
            </span>
            <textarea className={styles.field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label={`Withdrawal reason for ${m.title}`} />
          </label>
          <div className={styles.buttons}>
            <button type="button" className="btn secondary" disabled={busy || !withdraw.allowed} onClick={() => step('withdraw', 'Withdrawn. It is no longer public.')}>
              Withdraw from public view
            </button>
          </div>
          {!withdraw.allowed && <Why>Withdrawing is not available for this person: {withdraw.reason}</Why>}
        </div>
      )}
      {(m.state === 'draft' || m.state === 'returned') && !submit.allowed && <Why>Not available for this person: {submit.reason}</Why>}
    </article>
  );
}
