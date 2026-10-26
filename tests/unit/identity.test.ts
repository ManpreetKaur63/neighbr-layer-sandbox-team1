import { describe, expect, it } from 'vitest';
import {
  onboardingSteps,
  validateEmail,
  validatePassword,
  validateSignIn,
  validateSignUp,
} from '@/lib/identity';

describe('identity validation (M02 shells)', () => {
  it('accepts a well-formed email and rejects empty or malformed ones', () => {
    expect(validateEmail('name@example.com')).toBeNull();
    expect(validateEmail('')).toMatch(/required/);
    expect(validateEmail('not-an-email')).toMatch(/email like/);
    expect(validateEmail('a@b')).toMatch(/email like/);
  });

  it('requires a password of at least 8 characters', () => {
    expect(validatePassword('')).toMatch(/required/);
    expect(validatePassword('short')).toMatch(/at least 8/);
    expect(validatePassword('long-enough')).toBeNull();
  });

  it('sign-in validation lists every bad field', () => {
    expect(validateSignIn({ email: 'a@b.com', password: 'long-enough' })).toEqual([]);
    expect(validateSignIn({ email: '', password: '' })).toHaveLength(2);
  });

  it('sign-up validation requires a name, email, password, and org name for organizations', () => {
    expect(
      validateSignUp({ branch: 'individual', name: 'Demo', email: 'a@b.com', password: 'long-enough', organizationName: '' }),
    ).toEqual([]);
    expect(
      validateSignUp({ branch: 'organization', name: 'Demo', email: 'a@b.com', password: 'long-enough', organizationName: '' }),
    ).toContain('Organization name is required for an organization account.');
    expect(
      validateSignUp({ branch: 'individual', name: '', email: 'bad', password: 'short', organizationName: '' }),
    ).toHaveLength(3);
  });

  it('onboarding journeys differ by branch and end on a real destination', () => {
    const individual = onboardingSteps('individual');
    const organization = onboardingSteps('organization');
    expect(individual).toContain('Open the shared map');
    expect(organization).toContain('Open your workspace entry');
    expect(individual).not.toEqual(organization);
  });
});
