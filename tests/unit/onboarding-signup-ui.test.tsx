/**
 * M07 addendum — signup saves the account in the local database on this
 * device and sets the session role from it.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUpClient } from '@/app/signup/SignUpClient';
import { getAccount, getCurrentAccount, resetOnboardingDbForTests } from '@/lib/onboarding-db';
import { getOnboardingRole } from '@/lib/session';

beforeEach(async () => {
  await resetOnboardingDbForTests();
  window.sessionStorage.clear();
});

describe('signup saves the account in the local database (M07 addendum)', () => {
  it('creates the account, remembers it as signed in, and applies the role', async () => {
    const user = userEvent.setup();
    render(<SignUpClient />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Your name'), 'Demo Staff');
    await user.type(screen.getByLabelText('Email'), 'staff@example.com');
    await user.type(screen.getByLabelText(/Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Choose your role' }));

    await user.click(screen.getByRole('button', { name: /City staff/ }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Create demo account' }));

    expect(await screen.findByText('Onboarding complete (demo)')).toBeInTheDocument();
    // The lede says the same thing, so match the done screen's own sentence.
    expect(await screen.findByText(/Your demo account is saved/)).toBeInTheDocument();

    const saved = await getAccount('staff@example.com');
    expect(saved?.name).toBe('Demo Staff');
    expect(saved?.role).toBe('city-staff');
    expect(saved?.branch).toBe('individual');
    expect((await getCurrentAccount())?.email).toBe('staff@example.com');
    expect(getOnboardingRole()).toBe('city-staff');
  });

  it('does not store the password', async () => {
    const user = userEvent.setup();
    render(<SignUpClient />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Your name'), 'Demo Resident');
    await user.type(screen.getByLabelText('Email'), 'resident@example.com');
    await user.type(screen.getByLabelText(/Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Choose your role' }));
    await user.click(screen.getByRole('button', { name: /Resident/ }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Create demo account' }));
    expect(await screen.findByText('Onboarding complete (demo)')).toBeInTheDocument();
    const saved = await getAccount('resident@example.com');
    expect(saved).not.toBeNull();
    expect(JSON.stringify(saved)).not.toContain('password123');
    expect(Object.keys(saved ?? {})).not.toContain('password');
  });
});
