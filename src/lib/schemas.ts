import { z } from 'zod';

/** Contracts shared by fixtures, mock adapters and (later) real services. */

export const civicKindSchema = z.enum(['business', 'place', 'organization', 'issue', 'poll', 'event', 'project', 'post', 'alert']);
export type CivicKind = z.infer<typeof civicKindSchema>;

export const lensSchema = z.enum(['social', 'civic', 'combined']);
export type Lens = z.infer<typeof lensSchema>;

export const visibilitySchema = z.enum(['public', 'members', 'workspace', 'private']);
export type Visibility = z.infer<typeof visibilitySchema>;

const lngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type LngLat = z.infer<typeof lngLatSchema>;

export const citySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string(),
  country: z.string(),
  center: lngLatSchema,
  zoom: z.number().min(1).max(20),
});
export type City = z.infer<typeof citySchema>;

export const civicObjectSchema = z.object({
  id: z.string().min(1),
  kind: civicKindSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  cityId: z.string().min(1),
  geo: z.object({ type: z.literal('point'), coordinates: lngLatSchema }),
  status: z.string().min(1),
  visibility: visibilitySchema,
  workspaceId: z.string().optional(),
  /**
   * Set when a workspace has taken this record on (e.g. a BIA turns a community
   * issue into a task). The map detail panel and feeds show it, so the person
   * who reported the issue can see what happened next.
   */
  handledBy: z.object({ workspaceId: z.string().min(1), taskId: z.string().min(1) }).optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  tags: z.array(z.string()),
  /** Polls and similar actions limited to verified residents of the object's city. */
  restrictedTo: z.literal('residents').optional(),
  outcome: z.object({ summary: z.string(), date: z.string() }).optional(),
  /** Voting detail for polls (M04). Absent on other kinds. */
  poll: z
    .object({
      options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), votes: z.number().int().nonnegative() })).min(2),
      closed: z.boolean(),
    })
    .optional(),
  /** Every record in this repository is invented; the UI must say so. */
  synthetic: z.literal(true),
});
export type CivicObject = z.infer<typeof civicObjectSchema>;

export const boundaryAuthoritySchema = z.enum(['authoritative', 'working', 'illustrative']);
export type BoundaryAuthority = z.infer<typeof boundaryAuthoritySchema>;

const ringSchema = z.array(lngLatSchema).min(4);

export const boundaryFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().min(1),
  properties: z.object({
    id: z.string().min(1),
    cityId: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    authority: boundaryAuthoritySchema,
  }),
  geometry: z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema).min(1) }),
});
export type BoundaryFeature = z.infer<typeof boundaryFeatureSchema>;

export const boundaryCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(boundaryFeatureSchema),
});
export type BoundaryCollection = z.infer<typeof boundaryCollectionSchema>;

export const userContextSchema = z.object({
  displayName: z.string(),
  role: z.enum(['visitor', 'resident']),
  /** Verified home city. A resident keeps one fixed profile; location changes only create visitor context. */
  homeCityId: z.string().nullable(),
});
export type UserContext = z.infer<typeof userContextSchema>;

/* ---------- M04: social and civic activity ---------- */

/** A comment on a civic object (post, issue, poll, ...). */
export const commentSchema = z.object({
  id: z.string().min(1),
  objectId: z.string().min(1),
  author: z.string().min(1),
  text: z.string().min(1).max(500),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  synthetic: z.literal(true),
});
export type SocialComment = z.infer<typeof commentSchema>;

/** A notification for the demo identity. */
export const notificationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  read: z.boolean(),
  /** Where the notification leads, e.g. "/map?sel=w-hours-poll". */
  href: z.string().min(1),
  synthetic: z.literal(true),
});
export type NotificationItem = z.infer<typeof notificationSchema>;

/* ---------- M05: governed tenant workspaces (Layer 2) ---------- */

/**
 * A tenant workspace. One reusable shell serves both kinds; the kind only
 * changes the configuration (which tabs, counts and copy are shown), never
 * the layout code. There is deliberately no default workspace: a page must
 * name one explicitly (route `?ws=` or the first workspace of its kind).
 */
export const workspaceKindSchema = z.enum(['bia', 'business']);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

/** Access state: onboarding tenants can set up but are not yet verified. */
export const workspaceStatusSchema = z.enum(['onboarding', 'verified', 'restricted']);
export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;

export const workspaceSchema = z.object({
  id: z.string().min(1),
  kind: workspaceKindSchema,
  name: z.string().min(1),
  cityId: z.string().min(1),
  status: workspaceStatusSchema,
  summary: z.string().min(1),
  /**
   * BIA workspaces own a geographic boundary (id of a boundary feature). The
   * directory, events and community signals of a BIA are limited to records
   * inside it, never the whole city.
   */
  boundaryId: z.string().min(1).optional(),
  synthetic: z.literal(true),
});
export type Workspace = z.infer<typeof workspaceSchema>;

/** A person (demo name only) with a role inside one workspace. */
export const memberRoleSchema = z.enum(['owner', 'staff', 'member']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const workspaceMemberSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  role: memberRoleSchema,
  status: z.enum(['active', 'invited']),
  synthetic: z.literal(true),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

/** Work-queue item. Status moves only forward: open -> in-progress -> done. */
export const taskKindSchema = z.enum(['listing', 'offer', 'event', 'vacancy', 'city-works', 'general']);
export type TaskKind = z.infer<typeof taskKindSchema>;

export const taskStatusSchema = z.enum(['open', 'in-progress', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const workspaceTaskSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  kind: taskKindSchema,
  status: taskStatusSchema,
  /** The civic object (e.g. a community issue) this task was raised from. */
  sourceObjectId: z.string().min(1).optional(),
  synthetic: z.literal(true),
});
export type WorkspaceTask = z.infer<typeof workspaceTaskSchema>;

/** A tenant offer. Drafts are workspace-only; only published offers are public. */
export const offerStatusSchema = z.enum(['draft', 'published', 'expired']);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

export const workspaceOfferSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  businessId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: offerStatusSchema,
  synthetic: z.literal(true),
});
export type WorkspaceOffer = z.infer<typeof workspaceOfferSchema>;
