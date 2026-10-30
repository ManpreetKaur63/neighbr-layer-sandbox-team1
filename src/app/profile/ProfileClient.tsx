'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { useServices } from '@/services/use-services';
import type { UserContext } from '@/lib/schemas';

/**
 * M02 fixed profile shell. The profile comes from the demo session
 * (Demo resident, Windsor): one fixed profile, privacy toggles held only
 * in this page's state for the demo. Changing city on the map creates
 * visitor context — it does not convert this profile, and this page says so.
 */
export function ProfileClient() {
  const services = useServices();
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [showPublicly, setShowPublicly] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    services.session
      .getContext()
      .then((c) => {
        if (live) setCtx(c);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [services]);

  const state = failed ? 'error' : ctx === null ? 'loading' : 'success';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Profile</h1>
        <p className="lede">
          Fixed profile (demo). A person keeps one profile; visiting another
          city does not change it — see the map for visitor context.
          Everything here is invented demo data.
        </p>
        <StateBoundary
          state={state}
          loadingLabel="Loading profile…"
          errorTitle="Profile unavailable"
          errorHelp="Could not load the demo profile. Try again."
          onRetry={() => {
            setFailed(false);
            setCtx(null);
          }}
        >
          {ctx && (
            <>
              <article className="card">
                <h2 style={{ marginTop: 0 }}>{ctx.displayName}</h2>
                <p className="muted" style={{ margin: '0 0 4px' }}>
                  Role: {ctx.role} · Home city: {ctx.homeCityId ?? 'Not set'}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  Profile type is fixed for this demo identity. To see visitor
                  context, switch city on the map — your profile stays Windsor.
                </p>
              </article>
              <section aria-label="Privacy controls">
                <h2>Privacy controls (demo — saved in this page only)</h2>
                <label style={{ display: 'block', margin: '8px 0' }}>
                  <input type="checkbox" checked={showPublicly} onChange={(e) => setShowPublicly(e.target.checked)} />{' '}
                  Show my profile publicly
                </label>
                <label style={{ display: 'block', margin: '8px 0' }}>
                  <input type="checkbox" checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)} />{' '}
                  Share my location with the map
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setSaved(true)}
                >
                  Save privacy settings (demo)
                </button>
                {saved && <p role="status" className="muted">Privacy settings saved for this demo page only — nothing was stored.</p>}
              </section>
              <div className="btn-row">
                <Link className="btn secondary" href="/settings">Edit settings</Link>
                <Link className="btn secondary" href="/map">Open the map</Link>
              </div>
            </>
          )}
        </StateBoundary>
      </main>
    </>
  );
}
