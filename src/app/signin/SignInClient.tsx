'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { validateSignIn } from '@/lib/identity';

type View = 'form' | 'pending' | 'denied' | 'expired' | 'recovery' | 'success';

/**
 * M02 sign-in shell. No real authentication happens here: submitting a
 * valid-looking form shows the demo success state, and the denied / expired
 * / recovery states are previewable on purpose, so reviewers can see every
 * state the real identity service will one day produce.
 */
export function SignInClient() {
  const [view, setView] = useState<View>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const found = validateSignIn({ email, password });
    setErrors(found);
    if (found.length === 0) setView('success');
  }

  const inputStyle = { padding: 8, borderRadius: 8, border: '1px solid var(--line)', width: '100%' } as const;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Sign in</h1>
        <p className="lede">
          Demonstration shell only — no account is checked and no password is
          sent anywhere. Everything here is invented demo data.
        </p>

        {view === 'form' && (
          <section aria-label="Sign-in form" style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="Email" style={inputStyle} />
            </label>
            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" aria-label="Password" style={inputStyle} />
            </label>
            {errors.length > 0 && (
              <div role="alert">
                {errors.map((e) => (
                  <p key={e} className="muted" style={{ margin: '2px 0' }}>{e}</p>
                ))}
              </div>
            )}
            <div className="btn-row">
              <button type="button" className="btn" onClick={submit}>Sign in (demo)</button>
              <button type="button" className="btn secondary" onClick={() => setView('recovery')}>Forgot password?</button>
            </div>
            <p className="muted">
              Preview the other states:{' '}
              <button type="button" className="pill" onClick={() => setView('pending')}>Pending</button>{' '}
              <button type="button" className="pill" onClick={() => setView('denied')}>Denied</button>{' '}
              <button type="button" className="pill" onClick={() => setView('expired')}>Expired</button>
            </p>
            <p className="muted">
              No account yet? <Link href="/signup">Create one (demo)</Link>
            </p>
          </section>
        )}

        {view === 'pending' && (
          <section aria-label="Pending">
            <h2>Sign-in pending</h2>
            <p className="muted">Your sign-in is waiting for verification. This is a demo state — nothing is being verified.</p>
            <button type="button" className="btn secondary" onClick={() => setView('form')}>Back to sign-in</button>
          </section>
        )}
        {view === 'denied' && (
          <section aria-label="Denied">
            <h2>Sign-in denied</h2>
            <p className="muted">These demo credentials were not accepted. Check the email and password and try again — no real account is affected.</p>
            <button type="button" className="btn secondary" onClick={() => setView('form')}>Try again</button>
          </section>
        )}
        {view === 'expired' && (
          <section aria-label="Expired">
            <h2>Session expired</h2>
            <p className="muted">Your demo session has expired. Sign in again to continue.</p>
            <button type="button" className="btn secondary" onClick={() => setView('form')}>Sign in again</button>
          </section>
        )}
        {view === 'recovery' && (
          <section aria-label="Recovery">
            <h2>Recover your account</h2>
            <p className="muted">In the real service, a recovery link would be sent to your email. In this demo shell, no email is sent.</p>
            <div className="btn-row">
              <Link className="btn secondary" href="/signup">Create a demo account instead</Link>
              <button type="button" className="btn secondary" onClick={() => setView('form')}>Back to sign-in</button>
            </div>
          </section>
        )}
        {view === 'success' && (
          <section aria-label="Signed in">
            <h2>Signed in (demo)</h2>
            <p className="muted">You are signed in as a demo resident. No real account was checked.</p>
            <div className="btn-row">
              <Link className="btn" href="/profile">View your profile</Link>
              <Link className="btn secondary" href="/map">Open the map</Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
