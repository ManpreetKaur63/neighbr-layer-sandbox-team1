'use client';

import Link from 'next/link';
import { KIND_META } from '@/lib/kinds';
import { workspaceHref, workspaceHrefForObject } from '@/lib/workspace';
import type { BoundaryFeature, City, CivicObject } from '@/lib/schemas';
import type { VisitContext } from '@/lib/visit';
import styles from './map.module.css';

export type Selection =
  | { type: 'object'; object: CivicObject }
  | { type: 'boundary'; feature: BoundaryFeature };

const formatDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

const VISIBILITY_LABEL = {
  public: 'Public: anyone can see this',
  members: 'Members only',
  workspace: 'Visible inside its workspace',
  private: 'Private',
} as const;

const AUTHORITY_LABEL = {
  authoritative: 'Authoritative boundary',
  working: 'Working boundary (unofficial)',
  illustrative: 'Illustrative outline, not an official boundary',
} as const;

/** What lies inside a boundary, and which BIA workspace (if any) owns it. */
export interface BoundaryInfo {
  businesses: CivicObject[];
  biaWorkspaceId: string | null;
}

export function DetailPanel({
  selection,
  visit,
  city,
  boundaryInfo,
  onBack,
}: {
  selection: Selection;
  visit: VisitContext | null;
  city: City | undefined;
  boundaryInfo?: BoundaryInfo | null;
  onBack: () => void;
}) {
  return (
    <article className={styles.detail} aria-labelledby="detail-title">
      <button type="button" className={styles.back} onClick={onBack}>
        <span aria-hidden="true">←</span> Back to results
      </button>

      {selection.type === 'object' ? (
        <ObjectDetail object={selection.object} visit={visit} city={city} />
      ) : (
        <BoundaryDetail feature={selection.feature} info={boundaryInfo ?? null} />
      )}
    </article>
  );
}

function ObjectDetail({ object: o, visit, city }: { object: CivicObject; visit: VisitContext | null; city: City | undefined }) {
  const blocked = o.restrictedTo === 'residents' && visit?.mode === 'visitor';
  const workspaceLink = workspaceHrefForObject(o);
  return (
    <>
      <p className={styles.detailKind}>
        <span className={styles.swatch} style={{ background: KIND_META[o.kind].color }} aria-hidden="true" />
        {KIND_META[o.kind].label}
      </p>
      <h2 id="detail-title">{o.title}</h2>
      <p className={styles.badges}>
        <span className={styles.badge}>{o.status}</span>
        <span className={styles.badge}>{VISIBILITY_LABEL[o.visibility]}</span>
      </p>
      <p>{o.summary}</p>

      {o.outcome && (
        <section className={styles.outcome} aria-label="Outcome">
          <h3>Outcome</h3>
          <p>{o.outcome.summary}</p>
          <p className={styles.fine}>Closed {formatDate(o.outcome.date)}</p>
        </section>
      )}

      {o.restrictedTo === 'residents' && (
        <section className={blocked ? styles.restricted : styles.allowed} aria-label="Who can take part">
          <h3>{blocked ? 'Residents only' : 'Open to you'}</h3>
          <p>
            {blocked
              ? `Only verified residents of ${city?.name ?? 'this city'} can take this poll. You're viewing as a ${visit?.label.toLowerCase()}.`
              : 'You can take this poll as a verified resident. Voting arrives in the next milestone.'}
          </p>
        </section>
      )}

      {o.handledBy && (
        <section className={styles.allowed} aria-label="Follow-up">
          <h3>Being handled by a BIA</h3>
          <p>
            Status: <strong>{o.status}</strong>.{' '}
            <Link href={`${workspaceHref('bia', o.handledBy.workspaceId)}&tab=signals`}>See the BIA&apos;s follow-up</Link>
          </p>
        </section>
      )}

      {workspaceLink && (
        <section className={styles.allowed} aria-label="Workspace">
          <h3>Managed in a workspace</h3>
          <p>
            This record belongs to a tenant workspace.{' '}
            <Link href={workspaceLink}>Open in workspace</Link>
          </p>
        </section>
      )}

      {o.tags.length > 0 && (
        <ul className={styles.tags} aria-label="Tags">
          {o.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(o.updatedAt)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {o.geo.coordinates[1].toFixed(4)}, {o.geo.coordinates[0].toFixed(4)}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>Invented demo record. Not real civic activity.</dd>
        </div>
      </dl>
    </>
  );
}

function BoundaryDetail({ feature, info }: { feature: BoundaryFeature; info: BoundaryInfo | null }) {
  const p = feature.properties;
  return (
    <>
      <p className={styles.detailKind}>Area</p>
      <h2 id="detail-title">{p.name}</h2>
      <p className={styles.badges}>
        <span className={styles.badge}>{AUTHORITY_LABEL[p.authority]}</span>
      </p>
      <p>{p.description}</p>
      {info && (
        <section className={styles.allowed} aria-label="Businesses inside this area">
          <h3>
            {info.businesses.length} {info.businesses.length === 1 ? 'business' : 'businesses'} inside this outline
          </h3>
          {info.businesses.length > 0 && <p>{info.businesses.map((b) => b.title).join(', ')}</p>}
          {info.biaWorkspaceId && (
            <p>
              <Link href={`${workspaceHref('bia', info.biaWorkspaceId)}&tab=listings`}>Open this BIA&apos;s directory</Link>
            </p>
          )}
        </section>
      )}
      <section className={styles.restricted} aria-label="Trust note">
        <h3>Don&apos;t rely on this outline</h3>
        <p>
          Drawing an area on the map does not make it a legal boundary or establish membership of any
          organization. Official geometry needs a verified source.
        </p>
      </section>
    </>
  );
}
