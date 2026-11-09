import type { MemberRole, MemberStatus, WorkspaceStatus } from './schemas';

/**
 * M06 role and permission states. One pure function decides what an actor may
 * do in a workspace, given their role, whether their invitation was accepted,
 * and the workspace's access state. The UI uses it to disable controls and show
 * the reason; the mock WorkspacePort uses the same function to reject, so the
 * rule lives in one place (closes M05-D3 for the mock port; a production
 * workspace service must still enforce it server-side and with real sign-in).
 */
export type PermissionAction = 'view' | 'work' | 'publish' | 'manage';

export const PERMISSION_ACTIONS: { id: PermissionAction; label: string; example: string }[] = [
  { id: 'view', label: 'View', example: 'Open dashboard, members, content and events' },
  { id: 'work', label: 'Work', example: 'Advance tasks, draft offers and programs, claim listings' },
  { id: 'publish', label: 'Publish', example: 'Publish a draft offer or program' },
  { id: 'manage', label: 'Manage', example: 'Invite members and change roles' },
];

export interface ActorContext {
  role: MemberRole;
  memberStatus: MemberStatus;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
}

const ROLE_ACTIONS: Record<MemberRole, PermissionAction[]> = {
  owner: ['view', 'work', 'publish', 'manage'],
  staff: ['view', 'work', 'publish'],
  member: ['view'],
};

const VERB: Record<PermissionAction, string> = {
  view: 'view this workspace',
  work: 'work on tasks and drafts',
  publish: 'publish',
  manage: 'manage members',
};

export function decide(
  action: PermissionAction,
  actor: ActorContext,
  workspaceStatus: WorkspaceStatus,
): PermissionDecision {
  if (actor.memberStatus === 'invited') {
    return { allowed: false, reason: 'The invitation has not been accepted yet, so this person has no access.' };
  }
  if (action === 'view') return { allowed: true, reason: 'Every active member can view the workspace.' };
  if (workspaceStatus === 'restricted') {
    return { allowed: false, reason: 'This workspace is restricted, so it is read-only.' };
  }
  if (!ROLE_ACTIONS[actor.role].includes(action)) {
    return { allowed: false, reason: `The ${actor.role} role cannot ${VERB[action]}.` };
  }
  if (action === 'publish' && workspaceStatus !== 'verified') {
    return { allowed: false, reason: 'Only a verified workspace can publish.' };
  }
  return { allowed: true, reason: `The ${actor.role} role can ${VERB[action]} in a ${workspaceStatus} workspace.` };
}

/** Thrown message used by the port, so tests and the UI share one wording. */
export function denialMessage(decision: PermissionDecision): string {
  return `Not allowed: ${decision.reason}`;
}
