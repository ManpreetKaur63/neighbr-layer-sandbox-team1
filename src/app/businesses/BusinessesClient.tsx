'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { createMockServices } from '@/services/mock';
import { mapHref, workspaceHrefForObject } from '@/lib/workspace';
import type { CivicObject } from '@/lib/schemas';

/**
 * M05 business directory (member view): every business in the resident's home
 * city, with its claim state. Claimed listings link into their workspace;
 * unclaimed ones point to the Business workspace, where claiming happens.
 * This page never claims anything itself — claiming is a workspace action.
 */
export function BusinessesClient() {
  const services = useMemo(() => createMockServices(), []);
  const [items, setItems] = useState<CivicObject[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [cityName, setCityName] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [ctx, cities] = await Promise.all([services.session.getContext(), services.cities.list()]);
        const cityId = ctx.homeCityId ?? cities[0]?.id ?? 'windsor';
        if (live) setCityName(cities.find((c) => c.id === cityId)?.name ?? cityId);
        const list = await services.objects.list({ cityId, kinds: ['business'] });
        if (live) setItems(list);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [services]);

  const state = failed ? 'error' : items === null ? 'loading' : items.length === 0 ? 'empty' : 'success';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Community</p>
        <h1>Businesses</h1>
        <p className="lede">
          Business directory{cityName ? ` for ${cityName}` : ''}. Claimed listings are managed in a workspace;
          unclaimed ones are not yet managed by anyone here. Everything here is invented demo data.
        </p>
        <StateBoundary
          state={state}
          loadingLabel="Loading businesses…"
          emptyTitle="No businesses listed"
          emptyHelp="No business listings for this city in the demo data."
          errorTitle="Directory unavailable"
          errorHelp="Could not load businesses. Try again."
          onRetry={() => {
            setFailed(false);
            setItems(null);
          }}
        >
          {items?.map((o) => {
            const workspaceLink = workspaceHrefForObject(o);
            return (
              <article className="card" key={o.id} aria-label={`Business: ${o.title}`}>
                <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
                <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary} · {o.status}</p>
                <p className="muted" style={{ margin: '0 0 8px' }}>
                  {workspaceLink ? 'Claimed — managed in a workspace' : 'Not claimed yet'}
                </p>
                <div className="btn-row">
                  <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
                  {workspaceLink ? (
                    <Link className="btn secondary" href={workspaceLink}>Open in workspace</Link>
                  ) : (
                    <Link className="btn secondary" href="/business">Claim in a Business workspace</Link>
                  )}
                </div>
              </article>
            );
          })}
        </StateBoundary>
      </main>
    </>
  );
}
