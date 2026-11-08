import type {
  AuditEntry,
  BoundaryCollection,
  CasePriority,
  CaseSource,
  Communication,
  GovCase,
  CivicRequest,
  RequestKind,
  City,
  CivicObject,
  NotificationItem,
  SocialComment,
  TaskStatus,
  UserContext,
  Workspace,
  MemberRole,
  WorkspaceMember,
  WorkspaceOffer,
  WorkspaceProgram,
  WorkspaceTask,
} from '@/lib/schemas';
import type { ActorContext } from '@/lib/permissions';
import type { ObjectQuery } from '@/lib/query';
import type { HandlerAction } from '@/lib/requests';
import type { CaseStep, CommStep, GovActor } from '@/lib/governance';

/**
 * Service ports. The UI only ever talks to these interfaces. The mock adapters read synthetic JSON;
 * a production adapter would call Neighbr's governed services without any component changing.
 */
export interface CivicObjectPort {
  list(query: ObjectQuery): Promise<CivicObject[]>;
  get(id: string): Promise<CivicObject | null>;
}

export interface BoundaryPort {
  listForCity(cityId: string): Promise<BoundaryCollection>;
}

export interface CityPort {
  list(): Promise<City[]>;
  /** Free-text destination lookup. Production would use a places/geocoding service. */
  find(text: string): Promise<City | null>;
}

export interface SessionPort {
  getContext(): Promise<UserContext>;
}

/**
 * M04: interactive social and civic activity. The UI only ever talks to this
 * interface; the mock keeps the state in memory for the session, a production
 * adapter would call the governed activity service.
 */
export interface SocialPort {
  /** Current like count for an object. */
  likes(objectId: string): Promise<number>;
  /** Like; idempotent. Returns the new count. */
  react(objectId: string): Promise<number>;
  /** Unlike; idempotent. Returns the new count. */
  unreact(objectId: string): Promise<number>;
  liked(): Promise<string[]>;
  comments(objectId: string): Promise<SocialComment[]>;
  addComment(objectId: string, text: string): Promise<SocialComment>;
  /** Toggle save; resolves true when the object is now saved. */
  toggleSave(objectId: string): Promise<boolean>;
  saved(): Promise<string[]>;
  follow(targetId: string): Promise<void>;
  unfollow(targetId: string): Promise<void>;
  following(): Promise<string[]>;
  notifications(): Promise<NotificationItem[]>;
  markNotificationsRead(): Promise<void>;
  /** Vote in a poll; rejects on unknown poll/option or closed polls. */
  vote(pollId: string, optionId: string): Promise<CivicObject>;
  /** Report an issue; rejects on empty title. */
  reportIssue(input: { title: string; summary: string; cityId: string; coordinates?: [number, number] }): Promise<CivicObject>;
  /** Create a poll; rejects on empty question or fewer than 2 options. */
  createPoll(input: { question: string; options: string[]; cityId: string }): Promise<CivicObject>;
}

/**
 * M05: governed tenant workspaces. The UI only ever talks to this interface;
 * the mock keeps state in memory for the session, a production adapter would
 * call the governed workspace service (with real role checks). Rules enforced
 * here, not in components: unknown workspaces/tasks reject, task status moves
 * only forward (open -> in-progress -> done), a listing can be claimed by
 * only one workspace, and only drafts can be published.
 */
export interface WorkspacePort {
  workspaces(): Promise<Workspace[]>;
  /** Null (not a throw) for an unknown id, so pages can show "not found". */
  workspace(id: string): Promise<Workspace | null>;
  members(workspaceId: string): Promise<WorkspaceMember[]>;
  tasks(workspaceId: string): Promise<WorkspaceTask[]>;
  /**
   * M06: every mutating method takes an optional `actor`. When given, the port
   * applies the shared permission rules (`decide` in src/lib/permissions.ts)
   * and rejects with "Not allowed: ...". Without an actor the call behaves as
   * in M05. A restricted workspace rejects every mutation either way.
   */
  /** Advance a task one step forward; rejects on unknown task or a step back. */
  updateTask(workspaceId: string, taskId: string, status: TaskStatus, actor?: ActorContext): Promise<WorkspaceTask>;
  offers(workspaceId: string): Promise<WorkspaceOffer[]>;
  /** Create a draft offer; rejects on empty title or unknown workspace/business. */
  createOffer(
    input: { workspaceId: string; businessId: string; title: string; summary: string },
    actor?: ActorContext,
  ): Promise<WorkspaceOffer>;
  /** Publish a draft; rejects on unknown offer, a non-draft, or an unverified workspace. */
  publishOffer(offerId: string, actor?: ActorContext): Promise<WorkspaceOffer>;
  /**
   * Claim an unclaimed business listing into a workspace. Rejects on unknown
   * workspace/object, a non-business object, or a listing already claimed
   * by another workspace.
   */
  claimListing(workspaceId: string, objectId: string, actor?: ActorContext): Promise<CivicObject>;

  /** M06: programs, services and notices owned by a workspace. */
  programs(workspaceId: string): Promise<WorkspaceProgram[]>;
  /** Create a draft program; rejects on empty title, unknown workspace or unknown linked object. */
  createProgram(
    input: { workspaceId: string; title: string; summary: string; objectId?: string },
    actor?: ActorContext,
  ): Promise<WorkspaceProgram>;
  /** Publish a draft program; same gates as offers: draft only, verified workspace, publish permission. */
  publishProgram(programId: string, actor?: ActorContext): Promise<WorkspaceProgram>;

  /**
   * M06: member management. Inviting creates an `invited` member with no access
   * until `acceptInvite`. Changing a role never leaves a workspace without an
   * active owner.
   */
  inviteMember(
    input: { workspaceId: string; name: string; role: MemberRole },
    actor?: ActorContext,
  ): Promise<WorkspaceMember>;
  changeMemberRole(memberId: string, role: MemberRole, actor?: ActorContext): Promise<WorkspaceMember>;
  /** The invited person accepts (no actor: it is the invitee's own action). */
  acceptInvite(memberId: string): Promise<WorkspaceMember>;
}

/** The organization-side person acting on a request: a workspace member with a name for the record. */
export type HandlerActor = ActorContext & { name: string };

/**
 * M06 request journey: one request followed from the person who submits it,
 * through the organization that handles it, and back. The mock keeps the state
 * in memory for the session and shares it between pages; a production adapter
 * would call the governed request service. Rules enforced here, not in components:
 * transitions only follow the allowed paths, a decline, question or resolution
 * needs a note, handler actions need the `work` permission in the handling
 * workspace (and a restricted workspace rejects everything), and every change
 * is written to the request's history.
 */
export interface RequestPort {
  /** Requests of the demo person (`mine`) or the work queue of one workspace. Newest first. */
  list(filter: { mine: true } | { workspaceId: string }): Promise<CivicRequest[]>;
  /** Null (not a throw) for an unknown id, so pages can show "not found". */
  get(id: string): Promise<CivicRequest | null>;
  /**
   * Submit a request. Issues route to the BIA of the city; address requests name the
   * business workspace. Rejects on an empty title, an unknown object or no handler.
   */
  create(input: {
    kind: RequestKind;
    title: string;
    summary: string;
    cityId: string;
    objectId?: string;
    workspaceId?: string;
  }): Promise<CivicRequest>;
  /** An organization member acts on a request. Rejects with "Not allowed: ..." without permission. */
  handle(
    id: string,
    input: { action: HandlerAction; note?: string; assigneeId?: string },
    actor: HandlerActor,
  ): Promise<CivicRequest>;
  /** An organization member sends a message to the person. Needs the `work` permission. */
  send(id: string, text: string, actor: HandlerActor): Promise<CivicRequest>;
  /** The person replies. When more information was requested, the request goes back into review. */
  reply(id: string, text: string): Promise<CivicRequest>;
  /** The person follows up on a resolved or declined request, which reopens it. A note is required. */
  reopen(id: string, note: string): Promise<CivicRequest>;
}

/**
 * M07 governed response: cases that reach a public office, routing to government departments, public
 * communications with publication states, and the audit record of all of it. The mock keeps the state in
 * memory (saved in the browser session, shared between pages); a production adapter would call the governed
 * case and publication services. Rules enforced here, not in components: every mutation needs an acting person
 * (`GovActor`), a restricted workspace is read-only, only a verified, same-city department can take a case,
 * a note is needed where the other side needs a reason, the author of a communication cannot approve it
 * (four-eyes), and every attempt that is refused for permission or rule reasons is written to the audit
 * record just like the ones that worked. The record is append-only: this interface has no way to edit or
 * delete an entry.
 */
export interface GovernancePort {
  /** Cases an office received (`officeId`) or that were routed to a department (`departmentId`). Newest first. */
  cases(filter: { officeId: string } | { departmentId: string }): Promise<GovCase[]>;
  /** Null (not a throw) for an unknown id. */
  getCase(id: string): Promise<GovCase | null>;
  /** Log a new case at an office. Rejects on an empty title. */
  createCase(
    input: { title: string; summary: string; source: CaseSource; priority: CasePriority; objectId?: string },
    actor: GovActor,
  ): Promise<GovCase>;
  /** Route a received or returned case to a department. Refused if the department cannot take cases. */
  routeCase(caseId: string, departmentId: string, actor: GovActor, note?: string): Promise<GovCase>;
  /** A department accepts, returns or closes; an office may close a case it has not routed. */
  caseStep(caseId: string, step: Exclude<CaseStep, 'route'>, actor: GovActor, note?: string): Promise<GovCase>;

  /** Communications written in a workspace, newest first. */
  communications(workspaceId: string): Promise<Communication[]>;
  /** What the public sees for an office: its published items and published responses to its cases. */
  publicFeed(officeId: string): Promise<Communication[]>;
  createCommunication(
    input: { workspaceId: string; title: string; body: string; caseId?: string },
    actor: GovActor,
  ): Promise<Communication>;
  /** Submit, approve (publish), return or withdraw. Approval is refused for the author. */
  communicationStep(id: string, step: CommStep, actor: GovActor, note?: string): Promise<Communication>;

  /** The audit entries a workspace can see, newest first. Read-only. */
  audit(workspaceId: string): Promise<AuditEntry[]>;
}

export interface Services {
  objects: CivicObjectPort;
  boundaries: BoundaryPort;
  cities: CityPort;
  session: SessionPort;
  social: SocialPort;
  workspaces: WorkspacePort;
  requests: RequestPort;
  governance: GovernancePort;
}
