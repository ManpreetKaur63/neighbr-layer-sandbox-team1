import type { OnboardingRole, WorkspaceMember } from './schemas';

/** The role type lives with the other contracts in schemas.ts. */
export type { OnboardingRole } from './schemas';

/**
 * M07: roles moved out of the workspaces and into onboarding. A person chooses
 * a role when they sign up; the role is kept in this browser session only (a
 * new tab starts as a resident), and each workspace resolves it to one of its
 * own members. The old per-workspace "View as" switch and Roles & access tab
 * are gone: a workspace shows what *you* can do, it does not let you pick a
 * different person. This is still a demonstration, not security — there is no
 * sign-in, and a production service must check a real signed-in identity.
 *
 * M07 addendum: the account created at signup is now kept in a local
 * database on the device (see `onboarding-db.ts`). The role below is still
 * the working copy for this browser session; signup, sign-in and Settings
 * keep it in sync with the saved account.
 */
export interface OnboardingRoleDef {
  id: OnboardingRole;
  label: string;
  /** Plain words for the signup step. */
  description: string;
  /**
   * The workspace member this role acts as, in the demo. A resident is not a
   * member of any workspace, so they act with the least privilege everywhere.
   */
  memberId: string | null;
  /** Where the role's workspace lives, for the link shown after signup. */
  workspaceHref: string;
}

export const ONBOARDING_ROLES: OnboardingRoleDef[] = [
  {
    id: 'resident',
    label: 'Resident',
    description: 'You live here. Report issues, follow requests, join community activity.',
    memberId: null,
    workspaceHref: '/map',
  },
  {
    id: 'business-owner',
    label: 'Business owner',
    description: 'You run a business. Manage its listings, offers and requests.',
    memberId: 'm-bak-1',
    workspaceHref: '/business',
  },
  {
    id: 'bia-coordinator',
    label: 'BIA coordinator',
    description: 'You work for the BIA. Assign requests, ask for information, resolve them.',
    memberId: 'm-bia-2',
    workspaceHref: '/bia',
  },
  {
    id: 'org-member',
    label: 'Community organization member',
    description: 'You volunteer with a community organization. View its initiatives.',
    memberId: 'm-org-3',
    workspaceHref: '/organization',
  },
  {
    id: 'city-staff',
    label: 'City staff',
    description: 'You work for a city department. Assign reports, send updates, resolve them.',
    memberId: 'm-gov-2',
    workspaceHref: '/government',
  },
];

export const DEFAULT_ROLE: OnboardingRole = 'resident';

const STORAGE_KEY = 'neighbr-demo-role-v1';

function isRole(value: unknown): value is OnboardingRole {
  return typeof value === 'string' && ONBOARDING_ROLES.some((r) => r.id === value);
}

/** The role chosen at signup, or the default for someone who never signed up. */
export function getOnboardingRole(): OnboardingRole {
  try {
    if (typeof window === 'undefined') return DEFAULT_ROLE;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return isRole(stored) ? stored : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

/** Keep the chosen role for this browser session only. */
export function setOnboardingRole(role: OnboardingRole): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_KEY, role);
  } catch {
    /* storage blocked: the demo still works as a resident */
  }
}

export function roleDef(role: OnboardingRole): OnboardingRoleDef {
  return ONBOARDING_ROLES.find((r) => r.id === role) ?? ONBOARDING_ROLES[0]!;
}

/**
 * Which member of *this* workspace the onboarded role acts as. Null means the
 * person is not a member here, so the workspace treats them with the least
 * privilege (view only). A member who left the workspace (unknown id) also
 * resolves to null rather than to someone else.
 */
export function resolveActor(role: OnboardingRole, members: WorkspaceMember[]): WorkspaceMember | null {
  const def = roleDef(role);
  if (!def.memberId) return null;
  return members.find((m) => m.id === def.memberId) ?? null;
}
