'use client';

import { useState } from 'react';
import type { Services } from '@/services/ports';
import type { Workspace } from '@/lib/schemas';
import { AUDIT_ACTION_LABEL, auditCsv } from '@/lib/governance';
import { Tag, fmtStamp } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

type Filter = 'all' | 'done' | 'denied';

/**
 * The audit record: every governed step, who took it, in which role, when, what it changed, and every attempt
 * that was refused. It is read-only. The service has no way to edit or delete an entry, and the sequence numbers
 * would show a gap.
 */
export function AuditPanel({ services, workspace }: { services: Services; workspace: Workspace }) {
  const { audit, loaded, failed } = useGovData(services, workspace);
  const [filter, setFilter] = useState<Filter>('all');

  if (failed) return <p role="alert">Could not load the audit record. Try again.</p>;
  if (!loaded) return <p role="status" aria-busy="true">Loading the audit record…</p>;

  const refused = audit.filter((e) => e.outcome === 'denied').length;
  const shown = filter === 'all' ? audit : audit.filter((e) => e.outcome === filter);

  function download() {
    try {
      const blob = new Blob([auditCsv([...audit].reverse())], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${workspace.id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* downloads can be blocked: the list on screen is the record */
    }
  }

  return (
    <section aria-label="Audit record">
      <h2>Audit record</h2>
      <p className="muted">
        Every case step and every publication step in this workspace, newest first. An attempt that was refused is recorded too. Entries cannot be
        edited or deleted here. This is an invented demonstration record and has no real identity behind it.
      </p>
      <p>
        <strong>{audit.length}</strong> entries, <strong>{refused}</strong> refused.
      </p>
      <div className={styles.filters} role="group" aria-label="Filter the audit record">
        {(
          [
            ['all', `All (${audit.length})`],
            ['done', `Done (${audit.length - refused})`],
            ['denied', `Refused (${refused})`],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" className={`pill ${filter === id ? 'active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
        <button type="button" className="pill" onClick={download}>
          Download CSV
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="notice">No entries in this view.</p>
      ) : (
        <ol className={styles.audit} aria-label="Audit entries" reversed>
          {shown.map((e) => (
            <li className={styles.auditItem} key={e.id} data-outcome={e.outcome}>
              <div className={styles.auditHead}>
                <strong>
                  #{e.seq} · {AUDIT_ACTION_LABEL[e.action]}
                </strong>
                {e.outcome === 'denied' ? <Tag tone="alert">✕ Refused</Tag> : <Tag tone="ok">✓ Done</Tag>}
              </div>
              <dl className={styles.auditMeta}>
                <dt>When</dt>
                <dd>{fmtStamp(e.at)}</dd>
                <dt>Who</dt>
                <dd>
                  {e.actorName} ({e.actorRole})
                </dd>
                <dt>On</dt>
                <dd>{e.targetLabel}</dd>
                {e.fromState && (
                  <>
                    <dt>State</dt>
                    <dd>
                      {e.fromState}
                      {e.toState ? ` → ${e.toState}` : ' (unchanged)'}
                    </dd>
                  </>
                )}
                <dt>{e.outcome === 'denied' ? 'Why' : 'What'}</dt>
                <dd>{e.detail}</dd>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
