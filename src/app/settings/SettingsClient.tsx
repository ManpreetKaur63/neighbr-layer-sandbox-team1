'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { validateEmail, validateName } from '@/lib/identity';

/**
 * M02 settings shell: account, privacy and accessibility groups, each
 * with a success and an error state. Nothing is stored — saving only
 * updates this page's demo state, and the page says so.
 */
export function SettingsClient() {
  const [displayName, setDisplayName] = useState('Demo resident');
  const [email, setEmail] = useState('');
  const [privacyPublic, setPrivacyPublic] = useState(true);
  const [largerText, setLargerText] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const inputStyle = { padding: 8, borderRadius: 8, border: '1px solid var(--line)', width: '100%' } as const;

  function saveAccount() {
    const found = [validateName(displayName), email ? validateEmail(email) : null].filter(
      (e): e is string => e !== null,
    );
    setErrors(found);
    setNotice(found.length === 0 ? 'Account settings saved for this demo page only — nothing was stored.' : null);
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Settings</h1>
        <p className="lede">
          Demonstration shell only — changes here are not stored anywhere.
        </p>

        <section aria-label="Account settings" style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
          <h2>Account</h2>
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="Display name" style={inputStyle} />
          </label>
          <label>
            Email (optional, demo)
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="Email" style={inputStyle} />
          </label>
          {errors.length > 0 && (
            <div role="alert">
              {errors.map((e) => (
                <p key={e} className="muted" style={{ margin: '2px 0' }}>{e}</p>
              ))}
            </div>
          )}
          <div>
            <button type="button" className="btn secondary" onClick={saveAccount}>Save account settings (demo)</button>
          </div>
        </section>

        <section aria-label="Privacy settings">
          <h2>Privacy</h2>
          <label style={{ display: 'block', margin: '8px 0' }}>
            <input type="checkbox" checked={privacyPublic} onChange={(e) => setPrivacyPublic(e.target.checked)} />{' '}
            Show my profile publicly
          </label>
          <p className="muted">Turning this off hides the demo profile from public views. In this shell it only changes this page.</p>
        </section>

        <section aria-label="Accessibility settings">
          <h2>Accessibility</h2>
          <label style={{ display: 'block', margin: '8px 0' }}>
            <input type="checkbox" checked={largerText} onChange={(e) => setLargerText(e.target.checked)} />{' '}
            Larger text (demo toggle)
          </label>
          <p className="muted">
            The shell already uses 16px minimum type. This toggle is a demo
            placeholder for a real accessibility preference — it does not
            change the whole site in this shell.
          </p>
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
