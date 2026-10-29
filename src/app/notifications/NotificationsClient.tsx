'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { useServices } from '@/services/use-services';
import type { NotificationItem } from '@/lib/schemas';

/** Notifications (M04): activity updates for the demo identity. */
export function NotificationsClient() {
  const services = useServices();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    services.social
      .notifications()
      .then((list) => {
        if (live) setItems(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [services]);

  async function markAllRead() {
    await services.social.markNotificationsRead();
    setItems((ns) => ns?.map((n) => ({ ...n, read: true })) ?? null);
  }

  const state = failed ? 'error' : items === null ? 'loading' : items.length === 0 ? 'empty' : 'success';
  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity</p>
        <h1>Notifications{unread > 0 ? ` (${unread} unread)` : ''}</h1>
        <p className="lede">Activity updates for the demo identity.</p>
        {unread > 0 && (
          <p>
            <button type="button" className="btn secondary" onClick={markAllRead}>
              Mark all read
            </button>
          </p>
        )}
        <StateBoundary
          state={state}
          loadingLabel="Loading notifications…"
          emptyTitle="All caught up"
          emptyHelp="No notifications in the demo data."
          errorTitle="Notifications unavailable"
          errorHelp="Could not load notifications. Try again."
          onRetry={() => {
            setFailed(false);
            setItems(null);
          }}
        >
          {items?.map((n) => (
            <article className="card" key={n.id} style={n.read ? { opacity: 0.75 } : undefined}>
              {!n.read && <span className="badge">new</span>} <span className="muted">{n.createdAt}</span>
              <h3 style={{ margin: '8px 0 4px' }}>{n.title}</h3>
              <p className="muted">{n.body}</p>
              <Link className="btn secondary" href={n.href}>
                Open
              </Link>
            </article>
          ))}
        </StateBoundary>
        <p className="notice">Everything here is invented demo data.</p>
      </main>
    </>
  );
}
