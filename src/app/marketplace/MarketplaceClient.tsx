'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { createMockServices } from '@/services/mock';
import type { Services } from '@/services/ports';
import { STATUS_LABEL } from '@/lib/requests';
import { mapHref } from '@/lib/workspace';
import type { CivicObject, CivicRequest, Workspace, WorkspaceOffer } from '@/lib/schemas';

interface Listing {
  offer: WorkspaceOffer;
  workspace: Workspace;
  business: CivicObject | null;
}

const requestTitle = (offer: WorkspaceOffer) => `Address for ${offer.title}`;

/**
 * Marketplace (M06): published offers from business workspaces. Drafts never
 * appear. An address is never shown: the person presses Request address, which
 * sends a request to the business's work queue, and the answer comes back in Messages.
 */
export function MarketplaceClient({ services: injected }: { services?: Services }) {
  const services = useMemo(() => injected ?? createMockServices(), [injected]);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [mine, setMine] = useState<CivicRequest[]>([]);
  const [cityId, setCityId] = useState('');
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [session, all, requests] = await Promise.all([
        services.session.getContext(),
        services.workspaces.workspaces(),
        services.requests.list({ mine: true }),
      ]);
      const home = session.homeCityId ?? '';
      const businesses = all.filter((w) => w.kind === 'business' && w.cityId === home);
      const rows: Listing[] = [];
      for (const workspace of businesses) {
        const offers = await services.workspaces.offers(workspace.id);
        for (const offer of offers.filter((o) => o.status === 'published')) {
          rows.push({ offer, workspace, business: await services.objects.get(offer.businessId) });
        }
      }
      setCityId(home);
      setMine(requests);
      setListings(rows);
    } catch {
      setFailed(true);
    }
  }, [services]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  async function requestAddress(l: Listing) {
    setError(null);
    try {
      await services.requests.create({
        kind: 'address',
        title: requestTitle(l.offer),
        summary: `Pick-up details for ${l.business?.title ?? l.workspace.name}.`,
        cityId,
        objectId: l.offer.businessId,
        workspaceId: l.workspace.id,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.');
    }
  }

  const state = failed ? 'error' : listings === null ? 'loading' : listings.length === 0 ? 'empty' : 'success';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Community</p>
        <h1>Marketplace</h1>
        <p className="lede">
          Local offers from businesses. Addresses are shared on request: press Request address and the business answers in
          Messages. Everything here is invented demo data.
        </p>
        {error && <p role="alert">{error}</p>}
        <StateBoundary
          state={state}
          loadingLabel="Loading offers…"
          emptyTitle="No offers yet"
          emptyHelp="No business in your city has published an offer in the demo data."
          errorTitle="Marketplace unavailable"
          errorHelp="Could not load the offers. Try again."
          onRetry={() => {
            setFailed(false);
            setListings(null);
            void load();
          }}
        >
          {listings?.map((l) => {
            const sent = mine.find((r) => r.kind === 'address' && r.title === requestTitle(l.offer) && r.workspaceId === l.workspace.id);
            return (
              <article className="card" key={l.offer.id} aria-label={`Offer: ${l.offer.title}`}>
                <h3 style={{ margin: '0 0 4px' }}>{l.offer.title}</h3>
                <p className="muted" style={{ margin: '0 0 8px' }}>
                  {l.business?.title ?? l.workspace.name} · {l.offer.summary}
                </p>
                <div className="btn-row" style={{ margin: 0 }}>
                  {l.business && (
                    <Link className="btn secondary" href={mapHref(l.business.id)}>📍 View on map</Link>
                  )}
                  {sent ? (
                    <Link className="btn secondary" href={`/messages?id=${sent.id}`}>
                      Request sent · {STATUS_LABEL[sent.status]} · open in Messages
                    </Link>
                  ) : (
                    <button type="button" className="btn" onClick={() => requestAddress(l)}>
                      Request address
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </StateBoundary>
        <p className="notice">Only published offers appear here. Drafts stay inside the business workspace.</p>
      </main>
    </>
  );
}
