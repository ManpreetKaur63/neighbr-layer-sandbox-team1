import cities from '@mock/cities.json';
import boundaries from '@mock/boundaries.json';
import objects from '@mock/objects.json';
import session from '@mock/session.json';
import { z } from 'zod';
import {
  boundaryCollectionSchema,
  citySchema,
  civicObjectSchema,
  commentSchema,
  notificationSchema,
  userContextSchema,
  workspaceMemberSchema,
  workspaceOfferSchema,
  workspaceProgramSchema,
  workspaceSchema,
  workspaceTaskSchema,
  type BoundaryCollection,
  type City,
  type CivicObject,
  type NotificationItem,
  type SocialComment,
  type TaskStatus,
  type Workspace,
  type WorkspaceMember,
  type MemberRole,
  type WorkspaceOffer,
  type WorkspaceProgram,
  type WorkspaceTask,
} from '@/lib/schemas';
import { decide, denialMessage, type ActorContext, type PermissionAction } from '@/lib/permissions';
import { filterObjects } from '@/lib/query';
import type { Services, SocialPort, WorkspacePort } from '../ports';
import { appRequestStore, createRequestPort, requestNotifications, type RequestStore } from './requests';

export interface MockOptions {
  /** Artificial delay so loading states are visible and testable. */
  latencyMs?: number;
  /** Make every object request fail, to demonstrate the error state. */
  failObjects?: boolean;
  /** Return no objects, to demonstrate the empty state. */
  emptyObjects?: boolean;
  /**
   * M06: where the request journey keeps its state. Defaults to the store the running app shares
   * between pages; tests pass `createRequestStore()` so nothing leaks between them.
   */
  requestStore?: RequestStore;
}

/** Fixtures are validated against the shared contracts the moment the module loads. */
export const FIXTURES = {
  cities: z.array(citySchema).parse(cities) as City[],
  boundaries: boundaryCollectionSchema.parse(boundaries) as BoundaryCollection,
  objects: z.array(civicObjectSchema).parse(objects) as CivicObject[],
  session: userContextSchema.parse(session),
};

const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

const today = () => new Date().toISOString().slice(0, 10);

/** Seed comments for the M04 social-activity increment. */
const SEED_COMMENTS: SocialComment[] = [
  commentSchema.parse({
    id: 'cm-1', objectId: 'w-hours-poll', author: 'Demo neighbour',
    text: 'Midday works best for families — please keep the 11-2 slot.',
    createdAt: '2026-10-14', synthetic: true,
  }),
  commentSchema.parse({
    id: 'cm-2', objectId: 'w-hours-poll', author: 'Demo neighbour',
    text: 'Morning here — easier parking before 10.',
    createdAt: '2026-10-15', synthetic: true,
  }),
];

/** Seed like counts so the demo does not start at zero everywhere. */
const SEED_LIKES: Record<string, number> = {
  'w-hours-poll': 18,
  'w-transit-poll': 9,
};

const SEED_NOTIFICATIONS: NotificationItem[] = [
  notificationSchema.parse({
    id: 'n-1', title: 'Your comment received likes',
    body: 'Two neighbours liked your comment on “Which hours suit a Saturday market?”.',
    createdAt: '2026-10-16', read: false,
    href: '/map?sel=w-hours-poll', synthetic: true,
  }),
  notificationSchema.parse({
    id: 'n-2', title: 'High water advisory near you',
    body: 'Sections of the riverfront trail are closed after heavy rain.',
    createdAt: '2026-10-17', read: false,
    href: '/map?sel=w-alert-flood', synthetic: true,
  }),
];

/** Seed workspaces for the M05 Layer 2 increment. Ids match `workspaceId` on fixtures. */
const SEED_WORKSPACES: Workspace[] = [
  workspaceSchema.parse({
    id: 'ws-bia-sample', kind: 'bia', name: 'Sample Olde Riverside BIA', cityId: 'windsor',
    status: 'verified', summary: 'Corridor workspace for the Olde Riverside business area.', boundaryId: 'olde-riverside-corridor',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-biz-bakery', kind: 'business', name: 'Sample Riverside Bakery', cityId: 'windsor',
    status: 'verified', summary: 'Business workspace for a bakery in the corridor.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-biz-hardware', kind: 'business', name: 'Sample Hardware & Garden', cityId: 'windsor',
    status: 'onboarding', summary: 'Business workspace still completing onboarding and verification.',
    synthetic: true,
  }),
  // M06: institution, school and community organization tenants (same shell, new kinds).
  workspaceSchema.parse({
    id: 'ws-inst-library', kind: 'institution', name: 'Sample Riverside Public Library', cityId: 'windsor',
    status: 'verified', summary: 'Institution workspace for a public library branch: services, programs and events.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-school-elementary', kind: 'school', name: 'Sample Riverside Elementary School', cityId: 'windsor',
    status: 'verified', summary: 'Education workspace for an elementary school: family programs and notices.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-school-academy', kind: 'school', name: 'Sample Riverside Language Academy', cityId: 'windsor',
    status: 'restricted', summary: 'Education workspace under review: read-only until the review closes.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-org-neighbours', kind: 'organization', name: 'Sample Riverside Neighbours Association', cityId: 'windsor',
    status: 'verified', summary: 'Community organization workspace for neighbourhood initiatives and volunteers.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-org-trail', kind: 'organization', name: 'Sample Friends of the Trail', cityId: 'windsor',
    status: 'onboarding', summary: 'Community organization workspace still completing onboarding and verification.',
    synthetic: true,
  }),
  // M07: public office / government department tenants (same shell, new kind).
  workspaceSchema.parse({
    id: 'ws-gov-public-works', kind: 'government', name: 'Sample City of Windsor — Public Works', cityId: 'windsor',
    status: 'verified', summary: 'Government department workspace for roads, streetlights and waste: reports, assignments and updates.',
    synthetic: true,
  }),
  workspaceSchema.parse({
    id: 'ws-gov-parks', kind: 'government', name: 'Sample Parks & Recreation', cityId: 'windsor',
    status: 'onboarding', summary: 'Government department workspace still completing onboarding: parks, trails and facilities.',
    synthetic: true,
  }),
];

const SEED_MEMBERS: WorkspaceMember[] = [
  workspaceMemberSchema.parse({ id: 'm-bia-1', workspaceId: 'ws-bia-sample', name: 'Demo BIA chair', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bia-2', workspaceId: 'ws-bia-sample', name: 'Demo corridor coordinator', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bia-3', workspaceId: 'ws-bia-sample', name: 'Demo member business', role: 'member', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bak-1', workspaceId: 'ws-biz-bakery', name: 'Demo bakery owner', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bak-2', workspaceId: 'ws-biz-bakery', name: 'Demo bakery staff', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-hw-1', workspaceId: 'ws-biz-hardware', name: 'Demo hardware owner', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-hw-2', workspaceId: 'ws-biz-hardware', name: 'Demo hardware staff', role: 'staff', status: 'invited', synthetic: true }),
  // M06 members. Every tenant includes at least one invited person so the "no access yet" state is visible.
  workspaceMemberSchema.parse({ id: 'm-lib-1', workspaceId: 'ws-inst-library', name: 'Demo library administrator', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-lib-2', workspaceId: 'ws-inst-library', name: 'Demo program coordinator', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-lib-3', workspaceId: 'ws-inst-library', name: 'Demo partner organization', role: 'member', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-lib-4', workspaceId: 'ws-inst-library', name: 'Demo new coordinator', role: 'staff', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-sch-1', workspaceId: 'ws-school-elementary', name: 'Demo principal', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-sch-2', workspaceId: 'ws-school-elementary', name: 'Demo teacher', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-sch-3', workspaceId: 'ws-school-elementary', name: 'Demo parent council representative', role: 'member', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-sch-4', workspaceId: 'ws-school-elementary', name: 'Demo substitute teacher', role: 'staff', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-acad-1', workspaceId: 'ws-school-academy', name: 'Demo academy director', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-acad-2', workspaceId: 'ws-school-academy', name: 'Demo instructor', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-org-1', workspaceId: 'ws-org-neighbours', name: 'Demo organization lead', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-org-2', workspaceId: 'ws-org-neighbours', name: 'Demo volunteer coordinator', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-org-3', workspaceId: 'ws-org-neighbours', name: 'Demo volunteer', role: 'member', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-org-4', workspaceId: 'ws-org-neighbours', name: 'Demo new volunteer', role: 'member', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-trl-1', workspaceId: 'ws-org-trail', name: 'Demo trail group lead', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-trl-2', workspaceId: 'ws-org-trail', name: 'Demo trail coordinator', role: 'staff', status: 'invited', synthetic: true }),
  // M07 government members. Every tenant includes at least one invited person so the "no access yet" state is visible.
  workspaceMemberSchema.parse({ id: 'm-gov-1', workspaceId: 'ws-gov-public-works', name: 'Demo public works head', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-gov-2', workspaceId: 'ws-gov-public-works', name: 'Demo public works staff', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-gov-3', workspaceId: 'ws-gov-public-works', name: 'Demo partner organization', role: 'member', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-gov-4', workspaceId: 'ws-gov-public-works', name: 'Demo new inspector', role: 'staff', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-prk-1', workspaceId: 'ws-gov-parks', name: 'Demo parks head', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-prk-2', workspaceId: 'ws-gov-parks', name: 'Demo parks coordinator', role: 'staff', status: 'invited', synthetic: true }),
];

/** The BIA signal loop (M05 WP4) is traced through this task: community issue -> workspace task -> outcome. */
const SEED_TASKS: WorkspaceTask[] = [
  workspaceTaskSchema.parse({ id: 't-bia-vacancy', workspaceId: 'ws-bia-sample', title: 'Follow up the vacant storefront listing', kind: 'vacancy', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bia-works', workspaceId: 'ws-bia-sample', title: 'Track roadworks affecting shop access', kind: 'city-works', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bia-market', workspaceId: 'ws-bia-sample', title: 'Publish the Saturday market update', kind: 'event', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bak-hours', workspaceId: 'ws-biz-bakery', title: 'Confirm market-day opening hours', kind: 'listing', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bak-offer', workspaceId: 'ws-biz-bakery', title: 'Publish the weekend offer', kind: 'offer', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-hw-listing', workspaceId: 'ws-biz-hardware', title: 'Complete the claimed listing details', kind: 'listing', status: 'open', synthetic: true }),
  // M06 tasks.
  workspaceTaskSchema.parse({ id: 't-lib-rooms', workspaceId: 'ws-inst-library', title: 'Confirm room bookings for the market weekend', kind: 'event', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-lib-review', workspaceId: 'ws-inst-library', title: 'Review the draft program before publishing', kind: 'general', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-sch-room', workspaceId: 'ws-school-elementary', title: 'Confirm the family math night room', kind: 'event', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-sch-notice', workspaceId: 'ws-school-elementary', title: 'Review the draft field trip notice', kind: 'general', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-acad-review', workspaceId: 'ws-school-academy', title: 'Respond to the verification review', kind: 'general', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-org-recruit', workspaceId: 'ws-org-neighbours', title: 'Recruit volunteers for garden days', kind: 'general', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-org-walk', workspaceId: 'ws-org-neighbours', title: 'Share the walk route for review', kind: 'event', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-trl-profile', workspaceId: 'ws-org-trail', title: 'Complete the organization profile', kind: 'general', status: 'open', synthetic: true }),
  // M07 government tasks.
  workspaceTaskSchema.parse({ id: 't-gov-pothole', workspaceId: 'ws-gov-public-works', title: 'Fill potholes on Riverside Drive East', kind: 'city-works', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-gov-lights', workspaceId: 'ws-gov-public-works', title: 'Replace the streetlight on Wyandotte', kind: 'city-works', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-gov-sign', workspaceId: 'ws-gov-public-works', title: 'Confirm the new stop sign request', kind: 'general', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-prk-trail', workspaceId: 'ws-gov-parks', title: 'Complete the parks profile', kind: 'general', status: 'open', synthetic: true }),
];

const SEED_OFFERS: WorkspaceOffer[] = [
  workspaceOfferSchema.parse({ id: 'o-bak-1', workspaceId: 'ws-biz-bakery', businessId: 'w-bakery', title: 'Weekend bread bundle', summary: 'Demo offer for the Saturday market.', status: 'published', synthetic: true }),
  workspaceOfferSchema.parse({ id: 'o-hw-1', workspaceId: 'ws-biz-hardware', businessId: 'w-hardware', title: 'Garden weekend starter kit', summary: 'Draft offer, not public yet.', status: 'draft', synthetic: true }),
];

/** M06 programs. `objectId` points at an existing map object where one fits. */
const SEED_PROGRAMS: WorkspaceProgram[] = [
  workspaceProgramSchema.parse({ id: 'p-lib-tent', workspaceId: 'ws-inst-library', title: 'Reading tent at the harvest market', summary: 'Demo program: story hour and book swap beside the market.', status: 'published', objectId: 'w-market', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-lib-circles', workspaceId: 'ws-inst-library', title: 'Newcomer conversation circles', summary: 'Draft program, not public yet.', status: 'draft', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-sch-reading', workspaceId: 'ws-school-elementary', title: 'After-school reading club', summary: 'Demo program for families: weekly reading club.', status: 'published', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-sch-trip', workspaceId: 'ws-school-elementary', title: 'Spring field trip information', summary: 'Draft notice for families, not public yet.', status: 'draft', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-acad-english', workspaceId: 'ws-school-academy', title: 'Evening English conversation group', summary: 'Published before the review; visible but not editable while restricted.', status: 'published', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-org-garden', workspaceId: 'ws-org-neighbours', title: 'Streetscape garden volunteer days', summary: 'Demo initiative: monthly volunteer days.', status: 'published', objectId: 'w-garden', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-org-walks', workspaceId: 'ws-org-neighbours', title: 'Neighbourhood walk series', summary: 'Demo initiative: guided walks.', status: 'published', objectId: 'w-walk', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-org-calls', workspaceId: 'ws-org-neighbours', title: 'Winter check-in calls', summary: 'Draft initiative, not public yet.', status: 'draft', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-trl-cleanup', workspaceId: 'ws-org-trail', title: 'Trail lookout cleanup', summary: 'Draft initiative; cannot publish until the organization is verified.', status: 'draft', objectId: 'w-trail', synthetic: true }),
  // M07 government services.
  workspaceProgramSchema.parse({ id: 'p-gov-pothole', workspaceId: 'ws-gov-public-works', title: 'Pothole repair requests', summary: 'Demo service: how to report a pothole and what happens next.', status: 'published', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-gov-waste', workspaceId: 'ws-gov-public-works', title: 'Missed waste pickup', summary: 'Draft service, not public yet.', status: 'draft', synthetic: true }),
  workspaceProgramSchema.parse({ id: 'p-prk-trail', workspaceId: 'ws-gov-parks', title: 'Trail lookout cleanup', summary: 'Draft service; cannot publish until the department is verified.', status: 'draft', objectId: 'w-trail', synthetic: true }),
];

/** Task status may only move forward one step at a time. */
const NEXT_TASK_STATUS: Record<Exclude<TaskStatus, 'done'>, TaskStatus> = {
  open: 'in-progress',
  'in-progress': 'done',
};

export function createMockServices(options: MockOptions = {}): Services {
  const { latencyMs = 0, failObjects = false, emptyObjects = false, requestStore = appRequestStore } = options;

  // Working copy per factory call: writes (votes, reports, polls) stay in-session
  // and never leak into the validated fixtures or other factory instances.
  const objects: CivicObject[] = JSON.parse(JSON.stringify(FIXTURES.objects));
  // M06: issues reported earlier in this session (on another page) are part of the map, with their current status.
  objects.unshift(...(JSON.parse(JSON.stringify(requestStore.issueObjects)) as CivicObject[]));

  // M04 social state for the demo identity.
  const likeCounts = new Map<string, number>(Object.entries(SEED_LIKES));
  const likedIds = new Set<string>();
  const savedIds = new Set<string>();
  const followingIds = new Set<string>();
  const comments: SocialComment[] = SEED_COMMENTS.map((c) => ({ ...c }));
  const notifications: NotificationItem[] = SEED_NOTIFICATIONS.map((n) => ({ ...n }));
  let commentSeq = SEED_COMMENTS.length;
  let issueSeq = 0;
  let pollSeq = 0;

  // M05 workspace state: per-factory copies, so claims, tasks and offers never
  // leak into the fixtures or into another factory instance (as in M04).
  const workspaces: Workspace[] = SEED_WORKSPACES.map((w) => ({ ...w }));
  const members: WorkspaceMember[] = SEED_MEMBERS.map((m) => ({ ...m }));
  const tasks: WorkspaceTask[] = SEED_TASKS.map((t) => ({ ...t }));
  const offers: WorkspaceOffer[] = SEED_OFFERS.map((o) => ({ ...o }));
  const programs: WorkspaceProgram[] = SEED_PROGRAMS.map((p) => ({ ...p }));
  let offerSeq = SEED_OFFERS.length;
  let programSeq = SEED_PROGRAMS.length;
  let memberSeq = SEED_MEMBERS.length;

  function workspaceOrThrow(id: string): Workspace {
    const found = workspaces.find((w) => w.id === id);
    if (!found) throw new Error(`Workspace "${id}" not found.`);
    return found;
  }

  function objectOrThrow(id: string): CivicObject {
    const found = objects.find((o) => o.id === id);
    if (!found) throw new Error(`Object "${id}" not found.`);
    return found;
  }

  function memberOrThrow(id: string): WorkspaceMember {
    const found = members.find((m) => m.id === id);
    if (!found) throw new Error(`Member "${id}" not found.`);
    return found;
  }

  /**
   * M06 permission gate, used by every mutation. A restricted workspace is
   * read-only for everyone (with or without an actor); when an actor is given
   * the shared `decide` rules apply on top.
   */
  function guard(workspace: Workspace, action: PermissionAction, actor?: ActorContext): void {
    if (workspace.status === 'restricted') {
      throw new Error(denialMessage({ allowed: false, reason: 'This workspace is restricted, so it is read-only.' }));
    }
    if (actor) {
      const decision = decide(action, actor, workspace.status);
      if (!decision.allowed) throw new Error(denialMessage(decision));
    }
  }

  const social: SocialPort = {
    async likes(objectId) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      return likeCounts.get(objectId) ?? 0;
    },
    async react(objectId) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      if (!likedIds.has(objectId)) {
        likedIds.add(objectId);
        likeCounts.set(objectId, (likeCounts.get(objectId) ?? 0) + 1);
      }
      return likeCounts.get(objectId) ?? 0;
    },
    async unreact(objectId) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      if (likedIds.delete(objectId)) {
        likeCounts.set(objectId, Math.max(0, (likeCounts.get(objectId) ?? 0) - 1));
      }
      return likeCounts.get(objectId) ?? 0;
    },
    async liked() {
      return [...likedIds];
    },
    async comments(objectId) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      return comments.filter((c) => c.objectId === objectId);
    },
    async addComment(objectId, text) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      const clean = text.trim();
      if (!clean) throw new Error('Comment cannot be empty.');
      if (clean.length > 500) throw new Error('Comment is too long (max 500 characters).');
      const comment = commentSchema.parse({
        id: `cm-local-${Date.now()}-${(commentSeq += 1)}`,
        objectId,
        author: 'You (demo)',
        text: clean,
        createdAt: today(),
        synthetic: true,
      });
      comments.push(comment);
      return comment;
    },
    async toggleSave(objectId) {
      await wait(latencyMs);
      objectOrThrow(objectId);
      if (savedIds.has(objectId)) {
        savedIds.delete(objectId);
        return false;
      }
      savedIds.add(objectId);
      return true;
    },
    async saved() {
      return [...savedIds];
    },
    async follow(targetId) {
      await wait(latencyMs);
      if (!targetId.trim()) throw new Error('Target id is required.');
      followingIds.add(targetId);
    },
    async unfollow(targetId) {
      await wait(latencyMs);
      followingIds.delete(targetId);
    },
    async following() {
      return [...followingIds];
    },
    async notifications() {
      await wait(latencyMs);
      return [...requestNotifications(requestStore, FIXTURES.session.displayName), ...notifications];
    },
    async markNotificationsRead() {
      await wait(latencyMs);
      notifications.forEach((n) => {
        n.read = true;
      });
      requestNotifications(requestStore, FIXTURES.session.displayName).forEach((n) => {
        requestStore.readEventIds.add(n.id.slice('note-'.length));
      });
      requestStore.onChange?.();
    },
    async vote(pollId, optionId) {
      await wait(latencyMs);
      const poll = objectOrThrow(pollId);
      if (poll.kind !== 'poll' || !poll.poll) throw new Error(`Object "${pollId}" is not a poll.`);
      if (poll.poll.closed) throw new Error('This poll is closed.');
      const option = poll.poll.options.find((o) => o.id === optionId);
      if (!option) throw new Error(`Option "${optionId}" not found.`);
      option.votes += 1;
      return poll;
    },
    async reportIssue(input) {
      await wait(latencyMs);
      const title = input.title.trim();
      if (!title) throw new Error('A report needs a title.');
      const issue = civicObjectSchema.parse({
        id: `issue-local-${Date.now()}-${(issueSeq += 1)}`,
        kind: 'issue',
        title,
        summary: input.summary.trim() || 'Reported from the Neighbr shell (demo).',
        cityId: input.cityId,
        geo: { type: 'point', coordinates: input.coordinates ?? [-83.037, 42.317] },
        status: 'Open',
        visibility: 'public',
        updatedAt: today(),
        tags: ['issue', 'reported'],
        synthetic: true,
      });
      objects.unshift(issue);
      // Share it with the other pages (map, Pulse, workspaces) even if no organization receives it.
      requestStore.issueObjects.push(JSON.parse(JSON.stringify(issue)) as CivicObject);
      requestStore.onChange?.();
      return issue;
    },
    async createPoll(input) {
      await wait(latencyMs);
      const question = input.question.trim();
      const options = input.options.map((o) => o.trim()).filter(Boolean);
      if (!question) throw new Error('A poll needs a question.');
      if (options.length < 2) throw new Error('A poll needs at least two options.');
      const id = `poll-local-${Date.now()}-${(pollSeq += 1)}`;
      const poll = civicObjectSchema.parse({
        id,
        kind: 'poll',
        title: question,
        summary: 'Created from the Neighbr shell (demo).',
        cityId: input.cityId,
        geo: { type: 'point', coordinates: [-83.037, 42.317] },
        status: 'Open',
        visibility: 'public',
        updatedAt: today(),
        tags: ['poll'],
        restrictedTo: 'residents',
        poll: {
          options: options.map((label, i) => ({ id: `${id}-opt${i}`, label, votes: 0 })),
          closed: false,
        },
        synthetic: true,
      });
      objects.unshift(poll);
      return poll;
    },
  };

  const workspacesPort: WorkspacePort = {
    async workspaces() {
      await wait(latencyMs);
      return workspaces.map((w) => ({ ...w }));
    },
    async workspace(id) {
      await wait(latencyMs);
      const found = workspaces.find((w) => w.id === id);
      return found ? { ...found } : null;
    },
    async members(workspaceId) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
      return members.filter((m) => m.workspaceId === workspaceId).map((m) => ({ ...m }));
    },
    async tasks(workspaceId) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
      return tasks.filter((t) => t.workspaceId === workspaceId).map((t) => ({ ...t }));
    },
    async updateTask(workspaceId, taskId, status, actor) {
      await wait(latencyMs);
      guard(workspaceOrThrow(workspaceId), 'work', actor);
      const task = tasks.find((t) => t.id === taskId && t.workspaceId === workspaceId);
      if (!task) throw new Error(`Task "${taskId}" not found in this workspace.`);
      if (task.status === 'done') throw new Error('A done task cannot move back.');
      if (status !== NEXT_TASK_STATUS[task.status]) {
        throw new Error(`Task can only move from ${task.status} to ${NEXT_TASK_STATUS[task.status]}.`);
      }
      task.status = status;
      return { ...task };
    },
    async offers(workspaceId) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
      return offers.filter((o) => o.workspaceId === workspaceId).map((o) => ({ ...o }));
    },
    async createOffer(input, actor) {
      await wait(latencyMs);
      guard(workspaceOrThrow(input.workspaceId), 'work', actor);
      const business = objectOrThrow(input.businessId);
      if (business.kind !== 'business') throw new Error('An offer must belong to a business listing.');
      const title = input.title.trim();
      if (!title) throw new Error('An offer needs a title.');
      const offer = workspaceOfferSchema.parse({
        id: `offer-local-${Date.now()}-${(offerSeq += 1)}`,
        workspaceId: input.workspaceId,
        businessId: input.businessId,
        title,
        summary: input.summary.trim() || 'Offer from the Neighbr shell (demo).',
        status: 'draft',
        synthetic: true,
      });
      offers.push(offer);
      return { ...offer };
    },
    async publishOffer(offerId, actor) {
      await wait(latencyMs);
      const offer = offers.find((o) => o.id === offerId);
      if (!offer) throw new Error(`Offer "${offerId}" not found.`);
      const owner = workspaceOrThrow(offer.workspaceId);
      guard(owner, 'publish', actor);
      if (offer.status !== 'draft') throw new Error('Only a draft offer can be published.');
      if (owner.status !== 'verified') {
        throw new Error('Only a verified workspace can publish offers.');
      }
      offer.status = 'published';
      return { ...offer };
    },
    async claimListing(workspaceId, objectId, actor) {
      await wait(latencyMs);
      guard(workspaceOrThrow(workspaceId), 'work', actor);
      const object = objectOrThrow(objectId);
      if (object.kind !== 'business') throw new Error('Only a business listing can be claimed.');
      if (object.workspaceId && object.workspaceId !== workspaceId) {
        throw new Error('This listing is already claimed by another workspace.');
      }
      object.workspaceId = workspaceId;
      return { ...object };
    },

    // ---- M06: programs ----
    async programs(workspaceId) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
      return programs.filter((p) => p.workspaceId === workspaceId).map((p) => ({ ...p }));
    },
    async createProgram(input, actor) {
      await wait(latencyMs);
      guard(workspaceOrThrow(input.workspaceId), 'work', actor);
      const title = input.title.trim();
      if (!title) throw new Error('A program needs a title.');
      if (input.objectId) objectOrThrow(input.objectId);
      const program = workspaceProgramSchema.parse({
        id: `program-local-${Date.now()}-${(programSeq += 1)}`,
        workspaceId: input.workspaceId,
        title,
        summary: input.summary.trim() || 'Program from the Neighbr shell (demo).',
        status: 'draft',
        ...(input.objectId ? { objectId: input.objectId } : {}),
        synthetic: true,
      });
      programs.push(program);
      return { ...program };
    },
    async publishProgram(programId, actor) {
      await wait(latencyMs);
      const program = programs.find((p) => p.id === programId);
      if (!program) throw new Error(`Program "${programId}" not found.`);
      const owner = workspaceOrThrow(program.workspaceId);
      guard(owner, 'publish', actor);
      if (program.status !== 'draft') throw new Error('Only a draft program can be published.');
      if (owner.status !== 'verified') {
        throw new Error('Only a verified workspace can publish programs.');
      }
      program.status = 'published';
      return { ...program };
    },

    // ---- M06: member management ----
    async inviteMember(input, actor) {
      await wait(latencyMs);
      guard(workspaceOrThrow(input.workspaceId), 'manage', actor);
      const name = input.name.trim();
      if (!name) throw new Error('An invitation needs a name.');
      if (name.length > 60) throw new Error('A name can be at most 60 characters.');
      if (!['owner', 'staff', 'member'].includes(input.role)) throw new Error(`Unknown role "${input.role}".`);
      const duplicate = members.some(
        (m) => m.workspaceId === input.workspaceId && m.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) throw new Error('That person is already a member or has already been invited.');
      const member = workspaceMemberSchema.parse({
        id: `member-local-${Date.now()}-${(memberSeq += 1)}`,
        workspaceId: input.workspaceId,
        name,
        role: input.role,
        status: 'invited',
        synthetic: true,
      });
      members.push(member);
      return { ...member };
    },
    async changeMemberRole(memberId, role, actor) {
      await wait(latencyMs);
      const member = memberOrThrow(memberId);
      guard(workspaceOrThrow(member.workspaceId), 'manage', actor);
      if (!['owner', 'staff', 'member'].includes(role)) throw new Error(`Unknown role "${role}".`);
      if (member.role === role) throw new Error(`This person is already ${role}.`);
      if (member.role === 'owner' && member.status === 'active') {
        const activeOwners = members.filter(
          (m) => m.workspaceId === member.workspaceId && m.role === 'owner' && m.status === 'active',
        );
        if (activeOwners.length <= 1) throw new Error('A workspace must keep at least one active owner.');
      }
      member.role = role as MemberRole;
      return { ...member };
    },
    async acceptInvite(memberId) {
      await wait(latencyMs);
      const member = memberOrThrow(memberId);
      if (member.status !== 'invited') throw new Error('This person has no pending invitation.');
      member.status = 'active';
      return { ...member };
    },
  };

  return {
    objects: {
      async list(query) {
        await wait(latencyMs);
        if (failObjects) throw new Error('The mock service was told to fail (demo=error).');
        if (emptyObjects) return [];
        return filterObjects(objects, query);
      },
      async get(id) {
        await wait(latencyMs);
        return objects.find((o) => o.id === id) ?? null;
      },
    },
    boundaries: {
      async listForCity(cityId) {
        await wait(latencyMs);
        return {
          type: 'FeatureCollection',
          features: FIXTURES.boundaries.features.filter((f) => f.properties.cityId === cityId),
        };
      },
    },
    cities: {
      async list() {
        return FIXTURES.cities;
      },
      async find(text) {
        const needle = text.trim().toLowerCase();
        if (!needle) return null;
        return (
          FIXTURES.cities.find((c) => `${c.name} ${c.region} ${c.country}`.toLowerCase().includes(needle)) ?? null
        );
      },
    },
    session: {
      async getContext() {
        return FIXTURES.session;
      },
    },
    social,
    workspaces: workspacesPort,
    requests: createRequestPort({
      store: requestStore,
      objects,
      workspaces,
      members,
      boundaries: FIXTURES.boundaries.features,
      requesterName: FIXTURES.session.displayName,
      wait: () => wait(latencyMs),
    }),
  };
}
