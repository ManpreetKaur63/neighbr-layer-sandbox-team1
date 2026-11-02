import type {
  BoundaryCollection,
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
  reportIssue(input: { title: string; summary: string; cityId: string }): Promise<CivicObject>;
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
  /**
   * Decline a request with a recorded reason. From open/in-progress only;
   * declined is terminal. Requires the 'work' permission.
   */
  declineTask(workspaceId: string, taskId: string, reason: string, actor?: ActorContext): Promise<WorkspaceTask>;
  /**
   * Send a request back for more information, with a note saying what is
   * needed. From open/in-progress only. Requires the 'work' permission.
   */
  requestTaskInfo(workspaceId: string, taskId: string, note: string, actor?: ActorContext): Promise<WorkspaceTask>;
  /**
   * Provide the requested information; the request returns to open.
   * From needs-info only. Requires the 'work' permission.
   */
  provideTaskInfo(workspaceId: string, taskId: string, note: string, actor?: ActorContext): Promise<WorkspaceTask>;
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

export interface Services {
  objects: CivicObjectPort;
  boundaries: BoundaryPort;
  cities: CityPort;
  session: SessionPort;
  social: SocialPort;
  workspaces: WorkspacePort;
}
