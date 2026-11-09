'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { validateName } from '@/lib/identity';
import {
  clearOnboardingData,
  getCurrentAccount,
  getSettings,
  listAccounts,
  saveSettings,
  updateAccountRole,
} from '@/lib/onboarding-db';
import type { OnboardingAccount } from '@/lib/schemas';
import { getOnboardingRole, ONBOARDING_ROLES, roleDef, setOnboardingRole, type OnboardingRole } from '@/lib/session';

/**
 * M02 settings shell: account, privacy and accessibility groups, each
 * with a success and an error state.
 *
 * M07: the "Your role" section is where a demo role is changed. Roles moved
 * out of the workspaces and into onboarding; this is the one place to change
 * the role after signup. The role is kept in this browser session only.
 *
 * M07 addendum: everything on this page is now saved in the local database
 * on this device (IndexedDB — see `src/lib/onboarding-db.ts`): the display
 * name, the privacy and accessibility toggles, and the role (on the saved
 * account, when one exists). The "Demo data" section shows what is stored
 * and can clear it all. The email is the account key, so it is shown
 * read-only — changing it is not supported in this demo.
 */
export function SettingsClient() {
  const [displayName, setDisplayName] = useState('Demo resident');
  const [account, setAccount] = useState<OnboardingAccount | null>(null);
  const [accountCount, setAccountCount] = useState(0);
  const [privacyPublic, setPrivacyPublic] = useState(true);
  const [largerText, setLargerText] = useState(false);
  const [role, setRole] = useState<OnboardingRole>(() => getOnboardingRole());
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const inputStyle = { padding: 8, borderRadius: 8, border: '1px solid var(--line)', width: '100%' } as const;

  const load = useCallback(async () => {
    const settings = await getSettings();
    setDisplayName(settings.displayName);
    setPrivacyPublic(settings.showPublicly);
    setLargerText(settings.largerText);
    const current = await getCurrentAccount();
    setAccount(current);
    const all = await listAccounts();
    setAccountCount(all.length);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await load();
    })().catch(() => {
      /* defaults stand when the local database cannot be read */
    });
    return () => {
      live = false;
    };
  }, [load]);

  async function saveAccount() {
    const found = [validateName(displayName)].filter((e): e is string => e !== null);
    setErrors(found);
    if (found.length > 0) {
      setNotice(null);
      return;
    }
    const settings = await getSettings();
    await saveSettings({ ...settings, displayName });
    setNotice('Account settings saved in the local database on this device.');
  }

  async function changeRole(next: OnboardingRole) {
    setRole(next);
    setOnboardingRole(next);
    if (account) await updateAccountRole(account.email, next);
    setNotice(
      `Your role is now ${roleDef(next).label}. Saved in the local database on this device; workspaces will treat you as that role for this browser session.`,
    );
  }

  async function savePreference(patch: { showPublicly?: boolean; largerText?: boolean }) {
    const settings = await getSettings();
    await saveSettings({ ...settings, ...patch });
    setNotice('Preferences saved in the local database on this device.');
  }

  async function clearData() {
    await clearOnboardingData();
    setOnboardingRole('resident');
    setRole('resident');
    setAccount(null);
    setAccountCount(0);
    setDisplayName('Demo resident');
    setNotice('Demo data cleared: the local database is empty again and your role is back to Resident.');
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Settings</h1>
        <p className="lede">
          Saved in the local database on this device — not on any server.
        </p>

        <section aria-label="Account settings" style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
          <h2>Account</h2>
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="Display name" style={inputStyle} />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Email: {account ? account.email : 'no account signed in on this device'}{' '}
            {account ? '(the account key — it cannot be changed in this demo)' : ''}
          </p>
          {errors.length > 0 && (
            <div role="alert">
              {errors.map((e) => (
                <p key={e} className="muted" style={{ margin: '2px 0' }}>{e}</p>
              ))}
            </div>
          )}
          <div>
            <button type="button" className="btn secondary" onClick={saveAccount}>Save account settings</button>
          </div>
        </section>

        <section aria-label="Your role">
          <h2>Your role</h2>
          <p className="muted">
            Your role was chosen when you signed up, and it decides what you can do in workspaces. In
            production your role would come from your organization, not a demo switch.
          </p>
          <label>
            <span className="muted">Role: </span>
            <select
              aria-label="Your role"
              value={role}
              onChange={(e) => changeRole(e.target.value as OnboardingRole)}
              style={{ padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}
            >
              {ONBOARDING_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">Kept in this browser session; also saved on your account in the local database.</p>
        </section>

        <section aria-label="Privacy settings">
          <h2>Privacy</h2>
          <label style={{ display: 'block', margin: '8px 0' }}>
            <input
              type="checkbox"
              checked={privacyPublic}
              onChange={(e) => {
                setPrivacyPublic(e.target.checked);
                savePreference({ showPublicly: e.target.checked });
              }}
            />{' '}
            Show my profile publicly
          </label>
          <p className="muted">Turning this off hides the demo profile from public views. Saved when you change it.</p>
        </section>

        <section aria-label="Accessibility settings">
          <h2>Accessibility</h2>
          <label style={{ display: 'block', margin: '8px 0' }}>
            <input
              type="checkbox"
              checked={largerText}
              onChange={(e) => {
                setLargerText(e.target.checked);
                savePreference({ largerText: e.target.checked });
              }}
            />{' '}
            Larger text (demo toggle)
          </label>
          <p className="muted">
            The shell already uses 16px minimum type. This toggle is a demo
            placeholder for a real accessibility preference — it does not
            change the whole site in this shell.
          </p>
        </section>

        <section aria-label="Demo data">
          <h2>Demo data</h2>
          <p className="muted">
            {accountCount === 0
              ? 'The local database is empty — no demo account on this device yet.'
              : `${accountCount} demo account${accountCount === 1 ? '' : 's'} in the local database on this device.`}{' '}
            {account ? `Signed in as ${account.email}.` : 'Nobody is signed in.'}
          </p>
          <div>
            <button type="button" className="btn secondary" onClick={clearData}>Clear demo data</button>
          </div>
          <p className="muted">Deletes every demo account and setting from this browser, and resets your role to Resident.</p>
        </section>

        {notice && <p role="status" className="notice">{notice}</p>}
        <div className="btn-row">
          <Link className="btn secondary" href="/profile">Back to profile</Link>
          <Link className="btn secondary" href="/map">Open the map</Link>
        </div>
      </main>
    </>
  );
}
