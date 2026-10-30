'use client';

import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { SocialCard } from '@/components/SocialCard';
import { useServices } from '@/services/use-services';
import type { CivicObject } from '@/lib/schemas';

/**
 * Civic Pulse (M04): the map-linked feed. Posts, issues and polls for the
 * resident's home city, each with like / comment / save and a deep link
 * back to its pin on the shared map (`/map?sel=<id>`).
 */
export function PulseClient() {
  const services = useServices();
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
        const list = await services.objects.list({ cityId, kinds: ['post', 'issue', 'poll'] });
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
        <p>Civic</p>
        <h1>Pulse</h1>
        <p className="lede">
          Posts, issues and polls{cityName ? ` in ${cityName}` : ''} — react, discuss, save, and jump to each one on the map.
          Everything here is invented demo data.
        </p>
        <StateBoundary
          state={state}
          loadingLabel="Loading the pulse…"
          emptyTitle="Nothing pulsing yet"
          emptyHelp="No posts, issues or polls for this city in the demo data."
          errorTitle="The pulse dropped"
          errorHelp="Could not load the feed. Try again — no real data is affected."
          onRetry={() => {
            setFailed(false);
            setItems(null);
          }}
        >
          {items?.map((o) => <SocialCard key={o.id} object={o} services={services} />)}
        </StateBoundary>
      </main>
    </>
  );
}
