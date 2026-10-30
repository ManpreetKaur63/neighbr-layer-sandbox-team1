import type {
  BoundaryCollection,
  BoundaryFeature,
  City,
  CivicObject,
  NotificationItem,
  SocialComment,
  TaskStatus,
  UserContext,
  Workspace,
  WorkspaceMember,
  WorkspaceOffer,
  WorkspaceTask,
} from '@/lib/schemas';
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
  /** One boundary feature by id, or null. */
  get(id: string): Promise<BoundaryFeature | null>;
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
  reportIssue(input: {
    title: string;
    summary: string;
    cityId: string;
    /** [lng, lat]. Defaults to a downtown point when omitted. */
    coordinates?: [number, number];
  }): Promise<CivicObject>;
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
  /** Advance a task one step forward; rejects on unknown task or a step back. */
  updateTask(workspaceId: string, taskId: string, status: TaskStatus): Promise<WorkspaceTask>;
  offers(workspaceId: string): Promise<WorkspaceOffer[]>;
  /** Create a draft offer; rejects on empty title or unknown workspace/business. */
  createOffer(input: { workspaceId: string; businessId: string; title: string; summary: string }): Promise<WorkspaceOffer>;
  /** Publish a draft; rejects on unknown offer, a non-draft, or an unverified workspace. */
  publishOffer(offerId: string): Promise<WorkspaceOffer>;
  /**
   * Claim an unclaimed business listing into a workspace. Rejects on unknown
   * workspace/object, a non-business object, or a listing already claimed
   * by another workspace.
   */
  claimListing(workspaceId: string, objectId: string): Promise<CivicObject>;
  /**
   * BIA action: take a community issue on as a work-queue task. The issue must
   * sit inside the BIA's own boundary and not already be handled; the issue
   * becomes "Acknowledged" and shows who is handling it. Moving the task
   * forward later updates the issue (In progress, then Resolved with an
   * outcome) and notifies the community. Rejects on unknown ids, a
   * non-issue, an issue outside the boundary, an already-handled issue, or a
   * workspace that is not a verified BIA.
   */
  raiseTaskFromIssue(workspaceId: string, issueId: string): Promise<WorkspaceTask>;
}

export interface Services {
  objects: CivicObjectPort;
  boundaries: BoundaryPort;
  cities: CityPort;
  session: SessionPort;
  social: SocialPort;
  workspaces: WorkspacePort;
}
