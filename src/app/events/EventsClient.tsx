'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { createMockServices } from '@/services/mock';
import { mapHref } from '@/lib/workspace';
import type { CivicObject } from '@/lib/schemas';

/**
 * Events view (deferred from M04, built in M05): local events for the
 * resident's home city, each linking to its map pin. Workspace Events tabs
 * show the same events inside a tenant workspace; this page is the public view.
 */
export function EventsClient() {
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
        const list = await services.objects.list({ cityId, kinds: ['event'] });
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
        <h1>Events</h1>
        <p className="lede">
          Local events{cityName ? ` in ${cityName}` : ''}. Everything here is invented demo data.
        </p>
        <StateBoundary
          state={state}
          loadingLabel="Loading events…"
          emptyTitle="No events listed"
          emptyHelp="No events for this city in the demo data."
          errorTitle="Events unavailable"
          errorHelp="Could not load events. Try again."
          onRetry={() => {
            setFailed(false);
            setItems(null);
          }}
        >
          {items?.map((o) => (
            <article className="card" key={o.id} aria-label={`Event: ${o.title}`}>
              <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary} · {o.status}</p>
              <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
            </article>
          ))}
        </StateBoundary>
      </main>
    </>
  );
}
