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
  type WorkspaceOffer,
  type WorkspaceTask,
} from '@/lib/schemas';
import { filterObjects } from '@/lib/query';
import type { Services, SocialPort, WorkspacePort } from '../ports';

export interface MockOptions {
  /** Artificial delay so loading states are visible and testable. */
  latencyMs?: number;
  /** Make every object request fail, to demonstrate the error state. */
  failObjects?: boolean;
  /** Return no objects, to demonstrate the empty state. */
  emptyObjects?: boolean;
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
    status: 'verified', summary: 'Corridor workspace for the Olde Riverside business area.',
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
];

const SEED_MEMBERS: WorkspaceMember[] = [
  workspaceMemberSchema.parse({ id: 'm-bia-1', workspaceId: 'ws-bia-sample', name: 'Demo BIA chair', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bia-2', workspaceId: 'ws-bia-sample', name: 'Demo corridor coordinator', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bia-3', workspaceId: 'ws-bia-sample', name: 'Demo member business', role: 'member', status: 'invited', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bak-1', workspaceId: 'ws-biz-bakery', name: 'Demo bakery owner', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-bak-2', workspaceId: 'ws-biz-bakery', name: 'Demo bakery staff', role: 'staff', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-hw-1', workspaceId: 'ws-biz-hardware', name: 'Demo hardware owner', role: 'owner', status: 'active', synthetic: true }),
  workspaceMemberSchema.parse({ id: 'm-hw-2', workspaceId: 'ws-biz-hardware', name: 'Demo hardware staff', role: 'staff', status: 'invited', synthetic: true }),
];

/** The BIA signal loop (M05 WP4) is traced through this task: community issue -> workspace task -> outcome. */
const SEED_TASKS: WorkspaceTask[] = [
  workspaceTaskSchema.parse({ id: 't-bia-vacancy', workspaceId: 'ws-bia-sample', title: 'Follow up the vacant storefront listing', kind: 'vacancy', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bia-works', workspaceId: 'ws-bia-sample', title: 'Track roadworks affecting shop access', kind: 'city-works', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bia-market', workspaceId: 'ws-bia-sample', title: 'Publish the Saturday market update', kind: 'event', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bak-hours', workspaceId: 'ws-biz-bakery', title: 'Confirm market-day opening hours', kind: 'listing', status: 'in-progress', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-bak-offer', workspaceId: 'ws-biz-bakery', title: 'Publish the weekend offer', kind: 'offer', status: 'open', synthetic: true }),
  workspaceTaskSchema.parse({ id: 't-hw-listing', workspaceId: 'ws-biz-hardware', title: 'Complete the claimed listing details', kind: 'listing', status: 'open', synthetic: true }),
];

const SEED_OFFERS: WorkspaceOffer[] = [
  workspaceOfferSchema.parse({ id: 'o-bak-1', workspaceId: 'ws-biz-bakery', businessId: 'w-bakery', title: 'Weekend bread bundle', summary: 'Demo offer for the Saturday market.', status: 'published', synthetic: true }),
  workspaceOfferSchema.parse({ id: 'o-hw-1', workspaceId: 'ws-biz-hardware', businessId: 'w-hardware', title: 'Garden weekend starter kit', summary: 'Draft offer, not public yet.', status: 'draft', synthetic: true }),
];

/** Task status may only move forward one step at a time. */
const NEXT_TASK_STATUS: Record<Exclude<TaskStatus, 'done'>, TaskStatus> = {
  open: 'in-progress',
  'in-progress': 'done',
};

export function createMockServices(options: MockOptions = {}): Services {
  const { latencyMs = 0, failObjects = false, emptyObjects = false } = options;

  // Working copy per factory call: writes (votes, reports, polls) stay in-session
  // and never leak into the validated fixtures or other factory instances.
  const objects: CivicObject[] = JSON.parse(JSON.stringify(FIXTURES.objects));

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
  let offerSeq = SEED_OFFERS.length;

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
      return notifications;
    },
    async markNotificationsRead() {
      await wait(latencyMs);
      notifications.forEach((n) => {
        n.read = true;
      });
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
        geo: { type: 'point', coordinates: [-83.037, 42.317] },
        status: 'Open',
        visibility: 'public',
        updatedAt: today(),
        tags: ['issue', 'reported'],
        synthetic: true,
      });
      objects.unshift(issue);
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
    async updateTask(workspaceId, taskId, status) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
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
    async createOffer(input) {
      await wait(latencyMs);
      workspaceOrThrow(input.workspaceId);
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
    async publishOffer(offerId) {
      await wait(latencyMs);
      const offer = offers.find((o) => o.id === offerId);
      if (!offer) throw new Error(`Offer "${offerId}" not found.`);
      if (offer.status !== 'draft') throw new Error('Only a draft offer can be published.');
      if (workspaceOrThrow(offer.workspaceId).status !== 'verified') {
        throw new Error('Only a verified workspace can publish offers.');
      }
      offer.status = 'published';
      return { ...offer };
    },
    async claimListing(workspaceId, objectId) {
      await wait(latencyMs);
      workspaceOrThrow(workspaceId);
      const object = objectOrThrow(objectId);
      if (object.kind !== 'business') throw new Error('Only a business listing can be claimed.');
      if (object.workspaceId && object.workspaceId !== workspaceId) {
        throw new Error('This listing is already claimed by another workspace.');
      }
      object.workspaceId = workspaceId;
      return { ...object };
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
  };
}
