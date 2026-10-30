'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { useServices } from '@/services/use-services';
import type { CivicObject } from '@/lib/schemas';

/** Alerts (M04): approved public alerts tied to places, with map deep links. */
export function AlertsClient() {
  const services = useServices();
  const [alerts, setAlerts] = useState<CivicObject[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    services.objects
      .list({ cityId: 'windsor', kinds: ['alert'] })
      .then((list) => {
        if (live) setAlerts(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [services]);

  const state = failed ? 'error' : alerts === null ? 'loading' : alerts.length === 0 ? 'empty' : 'success';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Civic</p>
        <h1>Alerts</h1>
        <p className="lede">Approved public alerts for Windsor. Everything here is invented demo data.</p>
        <StateBoundary
          state={state}
          loadingLabel="Loading alerts…"
          emptyTitle="No active alerts"
          emptyHelp="There are no active alerts in the demo data."
          errorTitle="Alerts unavailable"
          errorHelp="Could not load alerts. Try again."
          onRetry={() => {
            setFailed(false);
            setAlerts(null);
          }}
        >
          {alerts?.map((a) => (
            <article className="card" key={a.id} aria-label={`Alert: ${a.title}`}>
              <span className="badge" style={{ borderColor: '#b91c1c', color: '#b91c1c' }}>
                ⚠ alert · {a.status}
              </span>{' '}
              <span className="muted">· {a.updatedAt}</span>
              <h3 style={{ margin: '8px 0 4px' }}>{a.title}</h3>
              <p className="muted">{a.summary}</p>
              <Link className="btn secondary" href={`/map?sel=${a.id}`}>
                📍 View on map
              </Link>
            </article>
          ))}
        </StateBoundary>
      </main>
    </>
  );
}
