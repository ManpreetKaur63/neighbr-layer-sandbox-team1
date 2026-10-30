'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { useServices } from '@/services/use-services';
import { mapHref, workspaceHrefForObject } from '@/lib/workspace';
import type { CivicObject } from '@/lib/schemas';

/**
 * M05 business directory (member view): every business in the resident's home
 * city, with its claim state. Claimed listings link into their workspace;
 * unclaimed ones point to the Business workspace, where claiming happens.
 * This page never claims anything itself — claiming is a workspace action.
 */
export function BusinessesClient() {
  const services = useServices();
  const searchParams = useSearchParams();
  // ?area=<boundary id> narrows the directory to one BIA corridor; absent means the whole city.
  const [area, setArea] = useState<string>(searchParams.get('area') ?? 'all');
  const [corridors, setCorridors] = useState<{ boundaryId: string; name: string }[]>([]);
  const [insideIds, setInsideIds] = useState<Set<string>>(new Set());
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
        const bias = (await services.workspaces.workspaces()).filter(
          (w) => w.kind === 'bia' && w.boundaryId && w.cityId === cityId,
        );
        const found = await Promise.all(
          bias.map(async (w) => ({
            boundaryId: w.boundaryId as string,
            name: (await services.boundaries.get(w.boundaryId as string))?.properties.name ?? w.name,
          })),
        );
        const selected = found.find((c) => c.boundaryId === area);
        const [list, inside] = await Promise.all([
          services.objects.list({ cityId, kinds: ['business'], boundaryId: selected?.boundaryId }),
          services.objects.list({ cityId, kinds: ['business'], boundaryId: found[0]?.boundaryId }),
        ]);
        if (live) {
          setCorridors(found);
          setInsideIds(new Set(found.length ? inside.map((o) => o.id) : []));
          setItems(list);
        }
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [services, area]);

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
        {corridors.length > 0 && (
          <div className="pill-row" role="group" aria-label="Directory area">
            <button
              type="button"
              className={`pill ${area === 'all' ? 'active' : ''}`}
              aria-pressed={area === 'all'}
              onClick={() => { setItems(null); setArea('all'); }}
            >
              All of {cityName}
            </button>
            {corridors.map((c) => (
              <button
                key={c.boundaryId}
                type="button"
                className={`pill ${area === c.boundaryId ? 'active' : ''}`}
                aria-pressed={area === c.boundaryId}
                onClick={() => { setItems(null); setArea(c.boundaryId); }}
              >
                Only inside {c.name}
              </button>
            ))}
          </div>
        )}
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
                  {insideIds.has(o.id) && corridors[0] ? ` · Inside ${corridors[0].name}` : ''}
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
