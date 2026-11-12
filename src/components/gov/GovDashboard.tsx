'use client';

import type { Services } from '@/services/ports';
import type { Workspace } from '@/lib/schemas';
import { CASE_PIPELINE, CASE_STATUS_SHORT, decideApproval, type GovActor } from '@/lib/governance';
import { CaseStatusTag, PublicationTag, Tag } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

/**
 * M07 dashboard for a public office or a government department: where cases stand, what waits for a decision,
 * and what is public. Everything is counted from the same records the Cases, Communications and Audit tabs show.
 */
export function GovDashboard({
  services,
  workspace,
  actor,
  departmentName,
  onOpen,
}: {
  services: Services;
  workspace: Workspace;
  actor: GovActor;
  departmentName: (id: string | undefined) => string;
  onOpen: (tab: 'cases' | 'communications' | 'audit' | 'public', id?: string) => void;
}) {
  const { cases, comms, audit, loaded, failed } = useGovData(services, workspace);

  if (failed) return <p role="alert">Could not load the dashboard. Try again.</p>;
  if (!loaded) return <p role="status" aria-busy="true">Loading the dashboard…</p>;

  const count = (s: string) => cases.filter((c) => c.status === s).length;
  const open = cases.filter((c) => c.status !== 'closed');
  const urgent = open.filter((c) => c.priority === 'urgent');
  const inReview = comms.filter((m) => m.state === 'in-review');
  const published = comms.filter((m) => m.state === 'published');
  const refused = audit.filter((e) => e.outcome === 'denied').length;

  // Cases that need this workspace's next step. A government workspace both receives cases (route them) and
  // works them (accept, return, close), so anything not yet in progress or closed waits for it.
  const waiting = cases
    .filter((c) => c.status === 'received' || c.status === 'returned' || c.status === 'routed')
    .sort((a, b) => Number(b.priority === 'urgent') - Number(a.priority === 'urgent'));

  const tiles: { label: string; value: number; flag?: boolean }[] = [
    { label: 'Waiting for a next step', value: waiting.length },
    { label: 'In progress', value: count('in-progress') },
    { label: 'Urgent and open', value: urgent.length, flag: urgent.length > 0 },
    { label: 'Awaiting approval', value: inReview.length },
    { label: 'Published', value: published.length },
    { label: 'Refused attempts', value: refused, flag: refused > 0 },
  ];

  return (
    <>
      <ul className={styles.tiles} aria-label="Counts">
        {tiles.map((t) => (
          <li className={styles.tile} key={t.label} data-flag={t.flag ? 'true' : undefined}>
            <strong>{t.value}</strong>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>

      <h3>Case pipeline</h3>
      <ol className={styles.pipeline} aria-label="Case pipeline">
        {CASE_PIPELINE.map((s) => (
          <li key={s} data-on={count(s) > 0 ? 'true' : undefined}>
            <strong>{count(s)}</strong>
            <span>{CASE_STATUS_SHORT[s]}</span>
          </li>
        ))}
      </ol>
      {count('returned') > 0 && (
        <p className="muted">{count('returned')} returned by a department, waiting for the office to route it again.</p>
      )}

      <h3>Needs attention</h3>
      {waiting.length === 0 && inReview.length === 0 ? (
        <p className="muted">Nothing is waiting for a decision.</p>
      ) : (
        <ul className={styles.attention}>
          {waiting.slice(0, 4).map((c) => (
            <li key={c.id} data-urgent={c.priority === 'urgent' ? 'true' : undefined}>
              <div>
                <strong>{c.reference}</strong> · {c.title}
              </div>
              <div className={styles.tags}>
                <CaseStatusTag status={c.status} />
                {c.priority === 'urgent' && <Tag tone="alert">▲ Urgent</Tag>}
                {c.departmentId && <Tag>{departmentName(c.departmentId)}</Tag>}
              </div>
              <button type="button" className="btn secondary" onClick={() => onOpen('cases', c.id)}>
                Open and work
              </button>
            </li>
          ))}
          {inReview.slice(0, 3).map((m) => {
            const d = decideApproval(actor, m, workspace);
            return (
              <li key={m.id}>
                <div>
                  <strong>{m.title}</strong>
                </div>
                <div className={styles.tags}>
                  <PublicationTag state={m.state} />
                  <Tag>By {m.authorName}</Tag>
                </div>
                <p className={styles.why} style={{ margin: 0 }}>{d.allowed ? 'You can approve this.' : d.reason}</p>
                <button type="button" className="btn secondary" onClick={() => onOpen('communications', m.id)}>
                  Open for review
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="btn-row">
        <button type="button" className="btn secondary" onClick={() => onOpen('public')}>
          See what the public sees
        </button>
        <button type="button" className="btn secondary" onClick={() => onOpen('audit')}>
          Open the audit record
        </button>
      </div>
    </>
  );
}
