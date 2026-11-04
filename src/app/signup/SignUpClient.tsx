'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SIGNUP_BRANCHES, onboardingSteps, validateSignUp, type SignupBranch } from '@/lib/identity';

/**
 * M02 account-creation + onboarding shell. Steps: choose a branch
 * (individual / organization) → details → review → done. The journey
 * checklist for the chosen branch is shown at every step, and the done
 * state links onward to the profile and to the workspace entries — never
 * to a dead end. No account is actually created.
 */
export function SignUpClient() {
  const [branch, setBranch] = useState<SignupBranch>('individual');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const steps = onboardingSteps(branch);
  const inputStyle = { padding: 8, borderRadius: 8, border: '1px solid var(--line)', width: '100%' } as const;

  function next() {
    if (step === 1) {
      const found = validateSignUp({ branch, name, email, password, organizationName });
      setErrors(found);
      if (found.length > 0) return;
    }
    setStep((s) => Math.min(s + 1, steps.length));
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Sign up</h1>
        <p className="lede">
          Demonstration shell only — no account is created and nothing you
          type is stored.
        </p>
        <p className="muted">Your onboarding journey for this branch:</p>
        <ol>
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        {step === 0 && (
          <section aria-label="Choose account type">
            <h2>Who are you joining as?</h2>
            <div className="pill-row">
              {SIGNUP_BRANCHES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`pill ${branch === b.id ? 'active' : ''}`}
                  aria-pressed={branch === b.id}
                  onClick={() => setBranch(b.id)}
                >
                  {b.label} — {b.hint}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setStep(1)}>Continue</button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-label="Account details" style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
            <h2>Your details</h2>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" style={inputStyle} />
            </label>
            {branch === 'organization' && (
              <label>
                Organization name
                <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} aria-label="Organization name" style={inputStyle} />
              </label>
            )}
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="Email" style={inputStyle} />
            </label>
            <label>
              Password (at least 8 characters, demo only)
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
              <button type="button" className="btn secondary" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="btn" onClick={next}>Review</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Review">
            <h2>Review (demo — nothing is saved)</h2>
            <p className="muted">Account type: {branch === 'individual' ? 'Individual' : 'Organization'}</p>
            <p className="muted">Name: {name || '—'}</p>
            {branch === 'organization' && <p className="muted">Organization: {organizationName || '—'}</p>}
            <p className="muted">Email: {email || '—'}</p>
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn" onClick={() => setStep(steps.length)}>Create demo account</button>
            </div>
          </section>
        )}

        {step >= steps.length && (
          <section aria-label="Onboarding complete">
            <h2>Onboarding complete (demo)</h2>
            <p className="muted">
              Your demo {branch} journey is complete. No account was created
              and nothing was stored.
            </p>
            <div className="btn-row">
              <Link className="btn" href="/profile">View your profile</Link>
              <Link className="btn secondary" href="/map">Open the shared map</Link>
              {branch === 'organization' && (
                <>
                  <Link className="btn secondary" href="/bia">BIA workspace</Link>
                  <Link className="btn secondary" href="/business">Business workspace</Link>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
