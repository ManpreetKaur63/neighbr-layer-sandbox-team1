import type { CivicRequest, RequestAction, RequestKind, RequestStatus } from './schemas';
import { decide, type ActorContext } from './permissions';
import type { WorkspaceStatus } from './schemas';

/**
 * M06 request journey rules that both the UI and the mock port share, so the
 * wording and the transitions live in one place.
 */
export type HandlerAction = 'assign' | 'start-review' | 'ask-info' | 'decline' | 'resolve';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  'in-review': 'In review',
  'needs-info': 'Needs more information',
  declined: 'Declined',
  resolved: 'Resolved',
};

export const KIND_LABEL: Record<RequestKind, string> = {
  issue: 'Reported issue',
  address: 'Address request',
};

export const ACTION_LABEL: Record<RequestAction, string> = {
  submitted: 'Request submitted',
  assigned: 'Assigned',
  'review-started': 'Review started',
  'info-requested': 'More information requested',
  'info-provided': 'Information provided',
  declined: 'Declined',
  resolved: 'Resolved',
  reopened: 'Reopened by the person (follow-up)',
  'message-sent': 'Message sent',
};

/** Which statuses each handler action may start from. */
export const HANDLER_FROM: Record<HandlerAction, RequestStatus[]> = {
  'start-review': ['submitted'],
  assign: ['submitted', 'in-review', 'needs-info'],
  'ask-info': ['submitted', 'in-review'],
  decline: ['submitted', 'in-review', 'needs-info'],
  resolve: ['in-review'],
};

/** Notes are required where the person on the other side needs a reason or a question. */
export const NOTE_REQUIRED: Record<HandlerAction, string | null> = {
  'start-review': null,
  assign: null,
  'ask-info': 'Say what information is needed.',
  decline: 'Give a reason for declining.',
  resolve: 'Say what was done.',
};

/** The status text written back onto the map object of a reported issue. */
export const ISSUE_STATUS_TEXT: Record<RequestStatus, string> = {
  submitted: 'Open',
  'in-review': 'In review',
  'needs-info': 'Needs information',
  declined: 'Closed',
  resolved: 'Resolved',
};

export function isClosed(status: RequestStatus): boolean {
  return status === 'declined' || status === 'resolved';
}

export interface AccessLine {
  who: string;
  can: string;
}

/**
 * "Who can view or change this request", spelled out for the screen. The
 * handler lines use the same `decide` rule the port enforces, so what the screen
 * says is what the service does.
 */
export function accessLines(
  request: CivicRequest,
  workspaceName: string,
  handlerRoleLabels: Record<'owner' | 'staff' | 'member', string>,
  workspaceStatus: WorkspaceStatus,
): AccessLine[] {
  const staff: ActorContext = { role: 'staff', memberStatus: 'active' };
  const member: ActorContext = { role: 'member', memberStatus: 'active' };
  const owner: ActorContext = { role: 'owner', memberStatus: 'active' };
  const can = (a: ActorContext) => decide('work', a, workspaceStatus).allowed;
  return [
    {
      who: `${request.requester} (the person who submitted it)`,
      can: isClosed(request.status)
        ? 'View, read the response and follow up to reopen. Cannot change the status.'
        : 'View, reply and read responses. Cannot change the status.',
    },
    {
      who: `${workspaceName}: ${handlerRoleLabels.owner} and ${handlerRoleLabels.staff}`,
      can: can(owner) && can(staff)
        ? 'View, assign, start review, ask for more information, decline, resolve and message.'
        : 'View only: this workspace is read-only.',
    },
    {
      who: `${workspaceName}: ${handlerRoleLabels.member}`,
      can: can(member) ? 'View, assign and update.' : 'View only. Cannot assign, update or message.',
    },
    { who: 'Everyone else', can: 'No access. Requests are not public.' },
  ];
}
