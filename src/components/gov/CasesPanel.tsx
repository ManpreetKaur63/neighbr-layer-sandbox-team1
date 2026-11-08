'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Services } from '@/services/ports';
import type { CasePriority, CaseSource, Communication, GovCase, Workspace } from '@/lib/schemas';
import {
  CASE_FROM,
  CASE_PIPELINE,
  CASE_STATUS_LABEL,
  AUDIT_ACTION_LABEL,
  canReceiveCases,
  decideCaseStep,
  type CaseStep,
  type GovActor,
} from '@/lib/governance';
import { decide } from '@/lib/permissions';
import { mapHref } from '@/lib/workspace';
import { CaseStatusTag, Feedback, PublicationTag, Tag, Why, fmtDate, fmtStamp, useAct } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

const SOURCE_LABEL: Record<CaseSource, string> = {
  'resident-report': 'Resident report',
  inquiry: 'Inquiry',
  office: 'Raised by the office',
};

/**
 * Cases. An office logs a case, routes it to a department and sees what happens next; a department accepts,
 * returns or closes the cases routed to it. On a phone the list and the case are separate screens with a way
 * back; on a wide screen they sit side by side. Every step goes through the governance port, which applies the
 * permission rules, writes the audit record and refuses what is not allowed.
 */
export function CasesPanel({
  services,
  workspace,
  actor,
  allWorkspaces,
  initialCaseId,
  onDraftResponse,
}: {
  services: Services;
  workspace: Workspace;
  actor: GovActor;
  allWorkspaces: Workspace[];
  initialCaseId?: string | null;
  onDraftResponse: (caseId: string) => void;
}) {
  const { cases, audit, loaded, failed, reload } = useGovData(services, workspace);
  const { notice, error, busy, act, clear } = useAct(reload);
  const isOffice = workspace.kind === 'office';
  const [picked, setPicked] = useState<string | null>(initialCaseId ?? null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>(initialCaseId ? 'detail' : 'list');
  const [note, setNote] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [responses, setResponses] = useState<Communication[]>([]);

  const selected = cases.find((c) => c.id === picked) ?? cases[0] ?? null;
  const selectedId = selected?.id ?? null;
  const officeId = isOffice ? workspace.id : selected?.officeId;

  // Responses to the selected case: this workspace's own, plus (for an office) the published ones from departments.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!selectedId || !officeId) {
        if (live) setResponses([]);
        return;
      }
      const [own, feed] = await Promise.all([services.governance.communications(workspace.id), services.governance.publicFeed(officeId)]);
      const merged = [...own, ...feed].filter((m) => m.caseId === selectedId);
      const seen = new Set<string>();
      if (live) setResponses(merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))));
    })().catch(() => {
      if (live) setResponses([]);
    });
    return () => {
      live = false;
    };
  }, [services, workspace.id, selectedId, officeId, audit]);

  const nameOf = (id: string | undefined) => allWorkspaces.find((w) => w.id === id)?.name ?? 'No department';
  const departments = allWorkspaces.filter((w) => w.kind === 'department');

  if (failed) return <p role="alert">Could not load cases. Try again.</p>;
  if (!loaded) return <p role="status" aria-busy="true">Loading cases…</p>;

  function open(id: string) {
    clear();
    setNote('');
    setRouteTo('');
    setPicked(id);
    setMobileView('detail');
  }

  const steps: CaseStep[] = isOffice ? ['route', 'close'] : ['accept', 'return', 'close'];

  return (
    <section aria-label={isOffice ? 'Cases' : 'Routed cases'}>
      <h2>{isOffice ? 'Cases' : 'Routed cases'}</h2>
      <p className="muted">
        {isOffice
          ? 'Cases that reached this office. Route each one to a verified department; the department then accepts, returns or closes it. Every step is written to the audit record.'
          : 'Cases an office routed to this department. Accept one to start work, return it with a reason, or close it with a note. Every step is written to the audit record.'}
      </p>
      <Feedback notice={notice} error={error} />

      {isOffice && (
        <NewCase
          disabled={!decide('work', actor, workspace.status).allowed}
          services={services}
          actor={actor}
          busy={busy}
          act={act}
        />
      )}

      {cases.length === 0 ? (
        <p className="notice">
          {isOffice
            ? 'No cases yet. Log one above.'
            : 'No cases are routed to this department. An office routes cases to a verified department from its Cases tab.'}
        </p>
      ) : (
        <div className={styles.split} data-mobile={mobileView}>
          <div className={styles.listPane}>
            <ul className={styles.rows} aria-label="Case list">
              {cases.map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.row} aria-current={c.id === selected?.id ? 'true' : undefined} onClick={() => open(c.id)}>
                    <span className={styles.rowTitle}>
                      {c.reference} · {c.title}
                    </span>
                    <span className={styles.tags}>
                      <CaseStatusTag status={c.status} />
                      {c.priority === 'urgent' && <Tag tone="alert">▲ Urgent</Tag>}
                      {isOffice && c.departmentId && <Tag>{nameOf(c.departmentId)}</Tag>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <div className={styles.detailPane}>
              <button type="button" className={`btn secondary ${styles.back}`} onClick={() => setMobileView('list')}>
                ← All cases
              </button>
              <article className={styles.detail} aria-label={`Case ${selected.reference}`}>
                <div>
                  <h3>
                    {selected.reference} · {selected.title}
                  </h3>
                  <div className={styles.tags} style={{ marginTop: 8 }}>
                    <CaseStatusTag status={selected.status} />
                    {selected.priority === 'urgent' && <Tag tone="alert">▲ Urgent</Tag>}
                    <Tag>{SOURCE_LABEL[selected.source]}</Tag>
                  </div>
                </div>
                <p style={{ margin: 0 }}>{selected.summary || 'No description.'}</p>

                <ol className={styles.stepper} aria-label="Where the case is">
                  {CASE_PIPELINE.map((s, i) => {
                    const at = CASE_PIPELINE.indexOf(selected.status === 'returned' ? 'received' : selected.status);
                    const state = i < at ? 'done' : i === at ? 'now' : 'todo';
                    return (
                      <li key={s} data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
                        {state === 'done' ? '✓ ' : ''}
                        {CASE_STATUS_LABEL[s]}
                      </li>
                    );
                  })}
                </ol>
                {selected.status === 'returned' && (
                  <p className="notice" style={{ margin: 0 }}>
                    Returned by a department. It is back with the office to route again.
                  </p>
                )}

                <dl className={styles.facts}>
                  <dt>Received</dt>
                  <dd>{fmtDate(selected.createdAt)}</dd>
                  <dt>Updated</dt>
                  <dd>{fmtDate(selected.updatedAt)}</dd>
                  <dt>Office</dt>
                  <dd>{nameOf(selected.officeId)}</dd>
                  <dt>Department</dt>
                  <dd>{selected.departmentId ? nameOf(selected.departmentId) : 'Not routed'}</dd>
                  <dt>Assigned to</dt>
                  <dd>{selected.assignee?.name ?? 'Nobody yet'}</dd>
                </dl>
                {selected.objectId && (
                  <div>
                    <Link className="btn secondary" href={mapHref(selected.objectId)}>
                      📍 View on map
                    </Link>
                  </div>
                )}

                <CaseActions
                  key={selected.id}
                  c={selected}
                  steps={steps}
                  isOffice={isOffice}
                  workspace={workspace}
                  actor={actor}
                  departments={departments}
                  routeTo={routeTo}
                  setRouteTo={setRouteTo}
                  note={note}
                  setNote={setNote}
                  busy={busy}
                  onRoute={() =>
                    act(() => services.governance.routeCase(selected.id, routeTo, actor, note), 'Case routed. The department can see it now.').then((ok) => {
                      if (ok) setNote('');
                    })
                  }
                  onStep={(step) =>
                    act(
                      () => services.governance.caseStep(selected.id, step as Exclude<CaseStep, 'route'>, actor, note),
                      step === 'accept' ? 'Case accepted.' : step === 'return' ? 'Case returned to the office.' : 'Case closed.',
                    ).then((ok) => {
                      if (ok) setNote('');
                    })
                  }
                />

                <div>
                  <h4 style={{ margin: '0 0 6px' }}>Responses to this case</h4>
                  {responses.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No response yet.
                    </p>
                  ) : (
                    <ul className={styles.record}>
                      {responses.map((m) => (
                        <li key={m.id}>
                          {m.title} <PublicationTag state={m.state} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.status !== 'closed' && (
                    <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={() => onDraftResponse(selected.id)}>
                      Write a response…
                    </button>
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px' }}>Record of this case</h4>
                  <ul className={styles.record} aria-label="Record of this case">
                    {audit
                      .filter((e) => e.targetType === 'case' && e.targetId === selected.id)
                      .reverse()
                      .map((e) => (
                        <li key={e.id} data-outcome={e.outcome}>
                          <strong>{e.outcome === 'denied' ? 'Refused: ' : ''}{AUDIT_ACTION_LABEL[e.action]}</strong> by {e.actorName} · {fmtStamp(e.at)}
                          <br />
                          {e.detail}
                        </li>
                      ))}
                  </ul>
                </div>
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CaseActions({
  c,
  steps,
  isOffice,
  workspace,
  actor,
  departments,
  routeTo,
  setRouteTo,
  note,
  setNote,
  busy,
  onRoute,
  onStep,
}: {
  c: GovCase;
  steps: CaseStep[];
  isOffice: boolean;
  workspace: Workspace;
  actor: GovActor;
  departments: Workspace[];
  routeTo: string;
  setRouteTo: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onRoute: () => void;
  onStep: (s: CaseStep) => void;
}) {
  const relevant = steps.filter((s) => (CASE_FROM[s] as readonly string[]).includes(c.status));
  if (relevant.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {c.status === 'closed'
          ? 'This case is closed. There are no further steps.'
          : isOffice
            ? 'The department takes the next step.'
            : 'No step is available for this case.'}
      </p>
    );
  }
  const needsNote = relevant.some((s) => s === 'return' || s === 'close');
  const routeDecision = decideCaseStep('route', actor, c, workspace);
  const eligible = departments.map((d) => ({ d, can: canReceiveCases(d, workspace) }));
  const chosen = eligible.find((x) => x.d.id === routeTo);

  return (
    <section className={styles.actions} aria-label="Next steps">
      <h4>Next steps</h4>
      {relevant.includes('route') && (
        <>
          <label className={styles.fieldLabel}>
            Route to a department
            <select className={styles.field} value={routeTo} onChange={(e) => setRouteTo(e.target.value)} aria-label="Route to a department">
              <option value="">Choose a department…</option>
              {eligible.map(({ d, can }) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {can.allowed ? '' : d.status === 'restricted' ? ' (restricted: cannot take cases)' : ' (onboarding: cannot take cases)'}
                </option>
              ))}
            </select>
          </label>
          {chosen && !chosen.can.allowed && (
            <Why>
              {chosen.can.reason} You can still try: the service will refuse and record the attempt.
            </Why>
          )}
        </>
      )}
      {needsNote && (
        <label className={styles.fieldLabel}>
          <span>
            Note <span className={styles.count}>(required to return or close)</span>
          </span>
          <textarea className={styles.field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note" />
        </label>
      )}
      <div className={styles.buttons}>
        {relevant.includes('route') && (
          <button type="button" className="btn" disabled={busy || !routeDecision.allowed || !routeTo} onClick={onRoute}>
            Route case
          </button>
        )}
        {relevant.includes('accept') && (
          <button type="button" className="btn" disabled={busy || !decideCaseStep('accept', actor, c, workspace).allowed} onClick={() => onStep('accept')}>
            Accept case
          </button>
        )}
        {relevant.includes('return') && (
          <button type="button" className="btn secondary" disabled={busy || !decideCaseStep('return', actor, c, workspace).allowed} onClick={() => onStep('return')}>
            Return to office
          </button>
        )}
        {relevant.includes('close') && (
          <button type="button" className="btn secondary" disabled={busy || !decideCaseStep('close', actor, c, workspace).allowed} onClick={() => onStep('close')}>
            {c.status === 'received' ? 'Close without routing' : 'Close case'}
          </button>
        )}
      </div>
      {!routeDecision.allowed && relevant.includes('route') && <Why>Not available for this person: {routeDecision.reason}</Why>}
      {!relevant.includes('route') &&
        (() => {
          const first = relevant[0];
          const d = first ? decideCaseStep(first, actor, c, workspace) : null;
          return d && !d.allowed ? <Why>Not available for this person: {d.reason}</Why> : null;
        })()}
    </section>
  );
}

function NewCase({
  services,
  actor,
  busy,
  act,
  disabled,
}: {
  services: Services;
  actor: GovActor;
  busy: boolean;
  act: (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;
  disabled: boolean;
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [source, setSource] = useState<CaseSource>('inquiry');
  const [priority, setPriority] = useState<CasePriority>('routine');
  return (
    <details className="card" style={{ maxWidth: 'none' }}>
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}>Log a new case</summary>
      <div className={styles.form} style={{ marginTop: 10 }}>
        <p className="muted" style={{ margin: 0 }}>
          Invented text only. Do not enter a real person’s name or contact details.
        </p>
        <label className={styles.fieldLabel}>
          Title
          <input className={styles.field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Case title" />
        </label>
        <label className={styles.fieldLabel}>
          What happened
          <textarea className={styles.field} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} aria-label="Case description" />
        </label>
        <label className={styles.fieldLabel}>
          Source
          <select className={styles.field} value={source} onChange={(e) => setSource(e.target.value as CaseSource)} aria-label="Case source">
            {(Object.keys(SOURCE_LABEL) as CaseSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          Priority
          <select className={styles.field} value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)} aria-label="Case priority">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={busy || disabled}
          onClick={async () => {
            const ok = await act(() => services.governance.createCase({ title, summary, source, priority }, actor), 'Case logged. It is waiting to be routed.');
            if (ok) {
              setTitle('');
              setSummary('');
            }
          }}
        >
          Log case
        </button>
        {disabled && <Why>Not available for this person: logging a case needs the work permission in a workspace that is not restricted.</Why>}
      </div>
    </details>
  );
}
