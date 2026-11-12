import type {
  AuditAction,
  CaseStatus,
  Communication,
  GovCase,
  MemberRole,
  PublicationState,
  Workspace,
} from './schemas';
import { decide, type ActorContext, type PermissionDecision } from './permissions';

/**
 * M07 governed response rules. Pure functions shared by the screens and the mock governance port, so the wording
 * on a disabled button and the refusal the service gives are the same sentence. Like `decide`, this is a
 * demonstration: there is no sign-in, so a production service must check a real identity.
 */

/** Who is acting: a member of the workspace they act in. */
export interface GovActor extends ActorContext {
  id: string;
  name: string;
  workspaceId: string;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  received: 'Received',
  routed: 'Routed to a department',
  'in-progress': 'In progress',
  returned: 'Returned to the office',
  closed: 'Closed',
};

export const CASE_STATUS_SHORT: Record<CaseStatus, string> = {
  received: 'Received',
  routed: 'Routed',
  'in-progress': 'In progress',
  returned: 'Returned',
  closed: 'Closed',
};

/** The order a case normally follows, for the pipeline on the dashboard. */
export const CASE_PIPELINE: CaseStatus[] = ['received', 'routed', 'in-progress', 'closed'];

export const PUBLICATION_LABEL: Record<PublicationState, string> = {
  draft: 'Draft (internal)',
  'in-review': 'In review (internal)',
  returned: 'Returned for changes (internal)',
  published: 'Published (public)',
  withdrawn: 'Withdrawn (no longer public)',
};

export const PUBLICATION_SHORT: Record<PublicationState, string> = {
  draft: 'Draft',
  'in-review': 'In review',
  returned: 'Returned',
  published: 'Published',
  withdrawn: 'Withdrawn',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  'case-created': 'Case logged',
  'case-routed': 'Case routed',
  'case-accepted': 'Case accepted',
  'case-returned': 'Case returned',
  'case-closed': 'Case closed',
  'comm-created': 'Draft created',
  'comm-submitted': 'Submitted for review',
  'comm-approved': 'Approved and published',
  'comm-returned': 'Returned for changes',
  'comm-withdrawn': 'Withdrawn',
};

/** Which case states each step may start from. */
export const CASE_FROM = {
  route: ['received', 'returned'],
  accept: ['routed'],
  return: ['routed', 'in-progress'],
  close: ['received', 'in-progress'],
} as const satisfies Record<string, CaseStatus[]>;

export type CaseStep = keyof typeof CASE_FROM;

/** Notes are required where the other side needs a reason. */
export const CASE_NOTE_REQUIRED: Record<CaseStep, string | null> = {
  route: null,
  accept: null,
  return: 'Say why the case is being returned, so the office can route it again.',
  close: 'Say how the case was closed.',
};

export const COMM_FROM = {
  submit: ['draft', 'returned'],
  approve: ['in-review'],
  return: ['in-review'],
  withdraw: ['published'],
} as const satisfies Record<string, PublicationState[]>;

export type CommStep = keyof typeof COMM_FROM;

export const COMM_NOTE_REQUIRED: Record<CommStep, string | null> = {
  submit: null,
  approve: null,
  return: 'Say what needs to change.',
  withdraw: 'Say why it is being withdrawn.',
};

/** A department takes routed cases only when it is verified and in the same city as the office.
 * Merged tree: there is no 'department' kind — a 'government' department (Public Works) takes cases.
 * Any other kind is not a department, so it cannot take cases. */
export function canReceiveCases(department: Workspace, office: Workspace): PermissionDecision {
  if (department.kind !== 'government') {
    return { allowed: false, reason: `${department.name} is not a department, so it cannot take cases.` };
  }
  if (department.cityId !== office.cityId) {
    return { allowed: false, reason: `${department.name} serves another city.` };
  }
  if (department.status === 'restricted') {
    return { allowed: false, reason: `${department.name} is restricted, so it cannot take new cases.` };
  }
  if (department.status === 'onboarding') {
    return { allowed: false, reason: `${department.name} is still onboarding and is not verified to take cases.` };
  }
  return { allowed: true, reason: `${department.name} is verified and can take cases.` };
}

/** Can this person take a step on a case, in the workspace they act in? Uses the shared `decide` rule. */
export function decideCaseStep(step: CaseStep, actor: GovActor, c: GovCase, workspace: Workspace): PermissionDecision {
  const base = decide('work', actor, workspace.status);
  if (!base.allowed) return base;
  const officeSide = step === 'route' || (step === 'close' && c.status === 'received');
  if (officeSide && actor.workspaceId !== c.officeId) {
    return { allowed: false, reason: 'Only the office that received the case can do this.' };
  }
  if (!officeSide && actor.workspaceId !== c.departmentId) {
    return { allowed: false, reason: 'Only the department the case is routed to can do this.' };
  }
  if (!(CASE_FROM[step] as readonly CaseStatus[]).includes(c.status)) {
    return { allowed: false, reason: `A case that is "${CASE_STATUS_LABEL[c.status]}" cannot take this step.` };
  }
  return { allowed: true, reason: base.reason };
}

/** Who may approve publication: needs the publish permission AND the owner role, and not the author. */
export type ApprovalKind = 'ok' | 'role' | 'author' | 'state' | 'access';

export interface ApprovalDecision extends PermissionDecision {
  kind: ApprovalKind;
}

export const APPROVER_ROLE: MemberRole = 'owner';

export function decideApproval(actor: GovActor, comm: Communication, workspace: Workspace): ApprovalDecision {
  const base = decide('publish', actor, workspace.status);
  if (!base.allowed) return { ...base, kind: 'access' };
  if (actor.workspaceId !== comm.workspaceId) {
    return { allowed: false, reason: 'Only the workspace that wrote this can approve it.', kind: 'access' };
  }
  if (actor.role !== APPROVER_ROLE) {
    return {
      allowed: false,
      reason: 'Only the office lead or department manager (the owner role) can approve publication.',
      kind: 'role',
    };
  }
  if (comm.state !== 'in-review') {
    return { allowed: false, reason: 'Only an item that is in review can be approved.', kind: 'state' };
  }
  if (comm.authorId === actor.id) {
    return {
      allowed: false,
      reason: 'Four-eyes rule: you wrote this, so a second person must approve it.',
      kind: 'author',
    };
  }
  return { allowed: true, reason: 'You can approve this: you did not write it.', kind: 'ok' };
}

/** Can this person take a non-approval step on a communication? */
export function decideCommStep(
  step: Exclude<CommStep, 'approve'>,
  actor: GovActor,
  comm: Communication,
  workspace: Workspace,
): PermissionDecision {
  const needsApprover = step === 'return' || step === 'withdraw';
  const base = decide(needsApprover ? 'publish' : 'work', actor, workspace.status);
  if (!base.allowed) return base;
  if (actor.workspaceId !== comm.workspaceId) {
    return { allowed: false, reason: 'Only the workspace that wrote this can change it.' };
  }
  if (needsApprover && actor.role !== APPROVER_ROLE) {
    return {
      allowed: false,
      reason: 'Only the office lead or department manager (the owner role) can do this.',
    };
  }
  if (!(COMM_FROM[step] as readonly PublicationState[]).includes(comm.state)) {
    return { allowed: false, reason: `An item that is "${PUBLICATION_SHORT[comm.state]}" cannot take this step.` };
  }
  return { allowed: true, reason: base.reason };
}

/** What the public sees: only published items. Everything else is withheld, and the screen says how many. */
export function isPublic(c: Communication): boolean {
  return c.state === 'published';
}

export function auditCsv(
  rows: {
    seq: number;
    at: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetLabel: string;
    outcome: string;
    detail: string;
  }[],
): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['seq', 'at', 'actor', 'role', 'action', 'target', 'outcome', 'detail'].join(',');
  const lines = rows.map((r) =>
    [r.seq, r.at, r.actorName, r.actorRole, r.action, r.targetLabel, r.outcome, r.detail].map(esc).join(','),
  );
  return [head, ...lines].join('\n');
}
