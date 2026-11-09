'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { getCurrentAccount, getSettings, saveSettings } from '@/lib/onboarding-db';
import type { OnboardingAccount } from '@/lib/schemas';
import { roleDef } from '@/lib/session';
import { createMockServices } from '@/services/mock';
import type { UserContext } from '@/lib/schemas';

/**
 * M02 fixed profile shell. The profile comes from the demo session
 * (Demo resident, Windsor): one fixed profile, privacy toggles held only
 * in this page's state for the demo. Changing city on the map creates
 * visitor context — it does not convert this profile, and this page says so.
 *
 * M07 addendum: when an account was created at signup, the profile shows
 * that saved account (from the local database on this device) instead, and
 * the privacy toggles are saved there too. With no saved account, the fixed
 * demo profile is shown.
 */
export function ProfileClient() {
  const services = useMemo(() => createMockServices(), []);
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [account, setAccount] = useState<OnboardingAccount | null>(null);
  const [showPublicly, setShowPublicly] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);

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
    getCurrentAccount()
      .then((a) => {
        if (live) setAccount(a);
      })
      .catch(() => {
        /* no saved account: the fixed demo profile is shown */
      });
    getSettings()
      .then((s) => {
        if (live) {
          setShowPublicly(s.showPublicly);
          setShareLocation(s.shareLocation);
        }
      })
      .catch(() => {
        /* defaults stand */
      });
    return () => {
      live = false;
    };
  }, [services]);

  const state = failed ? 'error' : ctx === null ? 'loading' : 'success';

  async function setPrivacy(nextPublic: boolean, nextLocation: boolean) {
    setShowPublicly(nextPublic);
    setShareLocation(nextLocation);
    const settings = await getSettings();
    await saveSettings({ ...settings, showPublicly: nextPublic, shareLocation: nextLocation });
    setPrivacyNote('Privacy settings saved in the local database on this device.');
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Profile</h1>
        <p className="lede">
          {account
            ? 'Your saved demo account, from the local database on this device. A person keeps one profile; visiting another city does not change it — see the map for visitor context.'
            : 'Fixed profile (demo). A person keeps one profile; visiting another city does not change it — see the map for visitor context. Everything here is invented demo data.'}
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
              {account ? (
                <article className="card">
                  <h2 style={{ marginTop: 0 }}>{account.name}</h2>
                  <p className="muted" style={{ margin: '0 0 4px' }}>
                    Role: {roleDef(account.role).label} · {account.branch === 'organization' ? `Organization: ${account.organizationName}` : 'Individual account'}
                  </p>
                  <p className="muted" style={{ margin: '0 0 4px' }}>Email: {account.email}</p>
                  <p className="muted" style={{ margin: 0 }}>
                    Member since {new Date(account.createdAt).toLocaleDateString()}. Saved in the local database on this
                    device — sign in with this email to load it again.
                  </p>
                </article>
              ) : (
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
                  <p className="muted">
                    No local account yet — <Link href="/signup">sign up</Link> to save one on this device.
                  </p>
                </>
              )}
              <section aria-label="Privacy controls">
                <h2>Privacy controls</h2>
                <label style={{ display: 'block', margin: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={showPublicly}
                    onChange={(e) => setPrivacy(e.target.checked, shareLocation)}
                  />{' '}
                  Show my profile publicly
                </label>
                <label style={{ display: 'block', margin: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={shareLocation}
                    onChange={(e) => setPrivacy(showPublicly, e.target.checked)}
                  />{' '}
                  Share my location with the map
                </label>
                {privacyNote && <p role="status" className="muted">{privacyNote}</p>}
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
