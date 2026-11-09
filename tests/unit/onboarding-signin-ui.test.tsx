/**
 * M07 addendum — sign-in looks the email up in the local database on this
 * device and applies the saved account's role for the session.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInClient } from '@/app/signin/SignInClient';
import { getCurrentAccount, resetOnboardingDbForTests, saveAccount } from '@/lib/onboarding-db';
import { getOnboardingRole } from '@/lib/session';

beforeEach(async () => {
  await resetOnboardingDbForTests();
  window.sessionStorage.clear();
});

async function signInAs(email: string) {
  const user = userEvent.setup();
  render(<SignInClient />);
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in (demo)' }));
  return user;
}

describe('sign-in against the local database (M07 addendum)', () => {
  it('signs in the saved account and applies its role for the session', async () => {
    await saveAccount({
      email: 'staff@example.com',
      name: 'Demo Staff',
      branch: 'individual',
      organizationName: '',
      role: 'city-staff',
      createdAt: '2026-11-07T12:00:00.000Z',
      updatedAt: '2026-11-07T12:00:00.000Z',
    });
    await signInAs('staff@example.com');
    // The success text is split across text nodes ("You are signed in as ",
    // the name, the role), so match on the paragraph's full text.
    expect(
      await screen.findByText((_content, element) =>
        element?.tagName === 'P' && /signed in as Demo Staff \(City staff\)/.test(element.textContent ?? ''),
      ),
    ).toBeInTheDocument();
    expect(getOnboardingRole()).toBe('city-staff');
    expect((await getCurrentAccount())?.email).toBe('staff@example.com');
  });

  it('says plainly when no account exists for that email on this device', async () => {
    await signInAs('nobody@example.com');
    expect(await screen.findByText('No account with this email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a demo account' })).toBeInTheDocument();
    expect(getOnboardingRole()).toBe('resident');
  });
});
