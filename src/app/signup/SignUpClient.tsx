'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SIGNUP_BRANCHES, onboardingSteps, validateRole, validateSignUp, type SignupBranch } from '@/lib/identity';
import { saveAccount, setCurrentAccount } from '@/lib/onboarding-db';
import { ONBOARDING_ROLES, roleDef, setOnboardingRole, type OnboardingRole } from '@/lib/session';

/**
 * M02 account-creation + onboarding shell. Steps: choose a branch
 * (individual / organization) → details → choose a role (M07) → review → done.
 * The journey checklist for the chosen branch is shown at every step, and the
 * done state links onward to the profile and to the workspace entries — never
 * to a dead end. The account is saved in the local database on this device
 * (IndexedDB — see `src/lib/onboarding-db.ts`); the password is validated
 * only and is never stored. The chosen role is also kept in this browser
 * session, so workspaces know what you can do. In production the role would
 * come from your organization.
 */
const DONE_STEP = 4;

export function SignUpClient() {
  const [branch, setBranch] = useState<SignupBranch>('individual');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const steps = onboardingSteps(branch);
  const inputStyle = { padding: 8, borderRadius: 8, border: '1px solid var(--line)', width: '100%' } as const;

  function next() {
    if (step === 1) {
      const found = validateSignUp({ branch, name, email, password, organizationName });
      setErrors(found);
      if (found.length > 0) return;
    }
    if (step === 2) {
      const roleError = validateRole(role);
      setErrors(roleError ? [roleError] : []);
      if (roleError) return;
    }
    setStep((s) => Math.min(s + 1, DONE_STEP));
  }

  async function createAccount() {
    if (!role || saving) return;
    setSaving(true);
    setOnboardingRole(role);
    const now = new Date().toISOString();
    const cleanEmail = email.trim().toLowerCase();
    try {
      const where = await saveAccount({
        email: cleanEmail,
        name: name.trim(),
        branch,
        organizationName: organizationName.trim(),
        role,
        createdAt: now,
        updatedAt: now,
      });
      await setCurrentAccount(cleanEmail);
      setSaveNote(
        where === 'indexeddb'
          ? 'Your demo account is saved in this browser’s local database — sign in with this email on this device to load it again.'
          : 'This browser would not keep the local database, so your account is held in memory only for this tab.',
      );
    } catch {
      setSaveNote('The account could not be saved on this device, so it is held in memory only for this tab.');
    }
    setSaving(false);
    setStep(DONE_STEP);
  }

  const chosen = role ? roleDef(role) : null;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Identity and profile</p>
        <h1>Sign up</h1>
        <p className="lede">
          Demonstration only — the account is saved in this browser’s local
          database, on this device. Your password is validated only; it is
          never stored.
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
              <button type="button" className="btn" onClick={next}>Choose your role</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Choose your role">
            <h2>Choose your role in Neighbr</h2>
            <p className="muted">
              Your role decides what you can do in workspaces — it is set here, at signup, not inside a
              workspace. In production your role would come from your organization.
            </p>
            <div style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
              {ONBOARDING_ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`pill ${role === r.id ? 'active' : ''}`}
                  aria-pressed={role === r.id}
                  onClick={() => setRole(r.id)}
                  style={{ textAlign: 'left', padding: 10 }}
                >
                  <strong>{r.label}</strong> — {r.description}
                </button>
              ))}
            </div>
            {errors.length > 0 && (
              <div role="alert">
                {errors.map((e) => (
                  <p key={e} className="muted" style={{ margin: '2px 0' }}>{e}</p>
                ))}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn secondary" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn" onClick={next}>Review</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-label="Review">
            <h2>Review</h2>
            <p className="muted">Account type: {branch === 'individual' ? 'Individual' : 'Organization'}</p>
            <p className="muted">Name: {name || '—'}</p>
            {branch === 'organization' && <p className="muted">Organization: {organizationName || '—'}</p>}
            <p className="muted">Email: {email || '—'}</p>
            <p className="muted">Role: {chosen ? chosen.label : '—'}</p>
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn" onClick={createAccount} disabled={saving}>
                {saving ? 'Saving…' : 'Create demo account'}
              </button>
            </div>
          </section>
        )}

        {step >= DONE_STEP && (
          <section aria-label="Onboarding complete">
            <h2>Onboarding complete (demo)</h2>
            <p className="muted">
              Your demo {branch} journey is complete. {saveNote ?? ''} Your role
              ({chosen ? chosen.label : 'Resident'}) is kept in this browser session too, so workspaces
              know what you can do.
            </p>
            <div className="btn-row">
              <Link className="btn" href="/profile">View your profile</Link>
              <Link className="btn secondary" href="/map">Open the shared map</Link>
              {chosen && chosen.id !== 'resident' && (
                <Link className="btn secondary" href={chosen.workspaceHref}>Open your workspace</Link>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
