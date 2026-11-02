/**
 * M02 entry and profile shells — pure, tested rules for the demo forms.
 * There is NO real authentication, account creation or profile storage in
 * this shell: these helpers only validate what a person typed, so the UI
 * can show specific errors. A production identity service replaces this
 * whole layer; no component logic depends on a real account existing.
 */

export type SignupBranch = 'individual' | 'organization';

export const SIGNUP_BRANCHES: { id: SignupBranch; label: string; hint: string }[] = [
  { id: 'individual', label: 'Individual', hint: 'A resident joining as themselves.' },
  { id: 'organization', label: 'Organization', hint: 'A business, BIA, institution or public office.' },
];

export function validateEmail(email: string): string | null {
  const clean = email.trim();
  if (!clean) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'Enter an email like name@example.com.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required.';
  return null;
}

export interface SignInInput {
  email: string;
  password: string;
}

/** All validation errors, in field order. Empty means the form may proceed. */
export function validateSignIn(input: SignInInput): string[] {
  return [validateEmail(input.email), validatePassword(input.password)].filter(
    (e): e is string => e !== null,
  );
}

export interface SignUpInput {
  branch: SignupBranch;
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export function validateSignUp(input: SignUpInput): string[] {
  const errors: string[] = [];
  const nameError = validateName(input.name);
  if (nameError) errors.push(nameError);
  const emailError = validateEmail(input.email);
  if (emailError) errors.push(emailError);
  const passwordError = validatePassword(input.password);
  if (passwordError) errors.push(passwordError);
  if (input.branch === 'organization' && !input.organizationName.trim()) {
    errors.push('Organization name is required for an organization account.');
  }
  return errors;
}

/** Onboarding journey steps per branch — the journey, not just the form. */
export function onboardingSteps(branch: SignupBranch): string[] {
  return branch === 'individual'
    ? ['Create your account', 'Set up your fixed profile', 'Choose your home city', 'Open the shared map']
    : [
        'Create your organization account',
        'Set up your organization profile',
        'Verification (demo — no real verification happens here)',
        'Open your workspace entry',
      ];
}
