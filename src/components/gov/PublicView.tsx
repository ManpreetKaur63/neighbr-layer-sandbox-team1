'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Services } from '@/services/ports';
import type { Communication, Workspace } from '@/lib/schemas';
import { PUBLICATION_SHORT } from '@/lib/governance';
import { StateBoundary } from '../StateBoundary';
import { Tag, fmtDate } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

/**
 * The public face of an office: exactly what a resident sees, and nothing else. It is built from the same
 * published records the other tabs use, so it cannot show a draft. The width switch lets a reviewer check the
 * phone layout from a desktop. What is withheld is counted, never shown.
 */
export function PublicView({ services, workspace, departmentName }: { services: Services; workspace: Workspace; departmentName: (id: string | undefined) => string }) {
  const { cases, comms, loaded, failed } = useGovData(services, workspace);
  const [feed, setFeed] = useState<Communication[] | null>(null);
  const [width, setWidth] = useState<'phone' | 'full'>('full');

  useEffect(() => {
    let live = true;
    (async () => {
      const f = await services.governance.publicFeed(workspace.id);
      if (live) setFeed(f);
    })().catch(() => {
      if (live) setFeed([]);
    });
    return () => {
      live = false;
    };
  }, [services, workspace.id, comms, cases]);

  if (failed) return <p role="alert">Could not load the public view. Try again.</p>;
  if (!loaded || feed === null) return <p role="status" aria-busy="true">Loading the public view…</p>;

  const closed = cases.filter((c) => c.status === 'closed').length;
  const withheld = (['draft', 'in-review', 'returned', 'withdrawn'] as const).map((s) => ({ s, n: comms.filter((m) => m.state === s).length }));
  const hasMapPin = workspace.id === 'ws-ward-sample';
  const caseRef = (id: string | undefined) => cases.find((c) => c.id === id)?.reference;

  return (
    <section aria-label="Public view">
      <h2>Public view</h2>
      <p className="muted">
        This is what residents see for {workspace.name}. It lists published items only. Drafts, items in review, returned items, withdrawn items
        and every case are left out.
      </p>
      <div className={styles.switch} role="group" aria-label="Preview width">
        <button type="button" aria-pressed={width === 'phone'} onClick={() => setWidth('phone')}>
          Phone width
        </button>
        <button type="button" aria-pressed={width === 'full'} onClick={() => setWidth('full')}>
          Full width
        </button>
      </div>

      <div className={styles.frame} data-width={width} aria-label="Public preview">
        <div className={styles.frameBar}>
          <span>neighbr · public office page</span>
          <span>Preview</span>
        </div>
        <div className={styles.frameBody}>
          <div>
            <h3>{workspace.name}</h3>
            <div className={styles.tags} style={{ marginTop: 8 }}>
              <Tag tone={workspace.status === 'verified' ? 'ok' : 'warn'}>
                {workspace.status === 'verified' ? '✓ Verified office' : workspace.status === 'onboarding' ? '⧖ Not verified yet' : '⊘ Restricted'}
              </Tag>
              <Tag>Windsor</Tag>
            </div>
          </div>
          <p style={{ margin: 0, maxWidth: 'none' }}>{workspace.summary}</p>
          <div className={styles.tags}>
            <Tag>{feed.length} public update{feed.length === 1 ? '' : 's'}</Tag>
            <Tag>{closed} case{closed === 1 ? '' : 's'} closed</Tag>
          </div>
          <div className="btn-row" style={{ margin: 0 }}>
            <Link className="btn" href="/issues/report">
              Report an issue
            </Link>
            <Link className="btn secondary" href={hasMapPin ? '/map?sel=w-ward' : '/map'}>
              📍 See us on the map
            </Link>
          </div>

          <h3 style={{ fontSize: '1.1rem' }}>Updates from the office</h3>
          <StateBoundary
            state={feed.length === 0 ? 'empty' : 'success'}
            emptyTitle="Nothing published yet"
            emptyHelp={
              workspace.status === 'verified'
                ? 'This office has no approved updates. Drafts stay internal until a second person approves them.'
                : 'This office is not verified, so it cannot publish anything yet.'
            }
          >
            {feed.map((m) => (
              <article className={styles.update} key={m.id}>
                <div className={styles.tags}>
                  <Tag tone="ok">◉ Published</Tag>
                  {m.kind === 'response' && <Tag>Answer to {caseRef(m.caseId) ?? 'a resident case'}</Tag>}
                </div>
                <h4>{m.title}</h4>
                <p>{m.body}</p>
                <span className="muted" style={{ fontSize: 'var(--text-small)' }}>
                  {fmtDate(m.publishedAt ?? m.updatedAt)} · From {m.workspaceId === workspace.id ? workspace.name : departmentName(m.workspaceId)}
                </span>
              </article>
            ))}
          </StateBoundary>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--text-small)' }}>
            Invented demonstration content. Internal case details are never shown on this page.
          </p>
        </div>
      </div>

      <div className={styles.withheld}>
        <strong>Withheld from the public view</strong>
        <ul>
          {withheld.map(({ s, n }) => (
            <li key={s}>
              {n} {PUBLICATION_SHORT[s].toLowerCase()}
            </li>
          ))}
          <li>
            {cases.length} internal case{cases.length === 1 ? '' : 's'} (never public)
          </li>
        </ul>
      </div>
    </section>
  );
}
