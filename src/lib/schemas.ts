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
export const workspaceKindSchema = z.enum(['bia', 'business', 'institution', 'organization', 'school', 'government']);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

/**
 * Access state: onboarding tenants can set up but are not yet verified;
 * restricted tenants are read-only (M06 built that behaviour in the port).
 */
export const workspaceStatusSchema = z.enum(['onboarding', 'verified', 'restricted']);
export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;

export const workspaceSchema = z.object({
  id: z.string().min(1),
  kind: workspaceKindSchema,
  name: z.string().min(1),
  cityId: z.string().min(1),
  status: workspaceStatusSchema,
  summary: z.string().min(1),
  /** The area a workspace covers (a boundary id). Set for a BIA: its directory shows only what is inside it. */
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

/* ---------- M06: programs and permission states (Layer 2, more tenant types) ---------- */

/**
 * A program, service or notice owned by a workspace (institution services,
 * community initiatives, school programs). Same draft -> published lifecycle
 * as an offer; drafts stay inside the workspace. `objectId` optionally points
 * at an existing civic object so the program can link to its map pin.
 */
export const programStatusSchema = z.enum(['draft', 'published']);
export type ProgramStatus = z.infer<typeof programStatusSchema>;

export const workspaceProgramSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: programStatusSchema,
  objectId: z.string().min(1).optional(),
  synthetic: z.literal(true),
});
export type WorkspaceProgram = z.infer<typeof workspaceProgramSchema>;

/** Who is acting: a member's role and whether their invitation was accepted. */
export const memberStatusSchema = z.enum(['active', 'invited']);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

/* ---------- M06 request journey: one request, followed from the person to the organization and back ---------- */

/** What the person is asking for. `issue` is a report on the map; `address` asks a business to share an address (Marketplace). */
export const requestKindSchema = z.enum(['issue', 'address']);
export type RequestKind = z.infer<typeof requestKindSchema>;

/** submitted -> in-review -> (needs-info <-> in-review) -> resolved or declined. A resolved or declined request can be reopened by the person. */
export const requestStatusSchema = z.enum(['submitted', 'in-review', 'needs-info', 'declined', 'resolved']);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const requestActionSchema = z.enum([
  'submitted',
  'assigned',
  'review-started',
  'info-requested',
  'info-provided',
  'declined',
  'resolved',
  'reopened',
  'message-sent',
]);
export type RequestAction = z.infer<typeof requestActionSchema>;

/** One line of the record of what happened: who did what, when. */
export const requestEventSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  actor: z.string().min(1),
  side: z.enum(['resident', 'handler', 'system']),
  action: requestActionSchema,
  note: z.string().optional(),
});
export type RequestEvent = z.infer<typeof requestEventSchema>;

/** A message in the thread between the person and the organization. */
export const requestMessageSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  from: z.enum(['resident', 'handler']),
  author: z.string().min(1),
  text: z.string().min(1).max(500),
});
export type RequestMessage = z.infer<typeof requestMessageSchema>;

export const civicRequestSchema = z.object({
  id: z.string().min(1),
  kind: requestKindSchema,
  title: z.string().min(1),
  summary: z.string(),
  cityId: z.string().min(1),
  /** The map object this is about: the reported issue, or the business listing. */
  objectId: z.string().optional(),
  /** The workspace that handles the request (its work queue). */
  workspaceId: z.string().min(1),
  requester: z.string().min(1),
  status: requestStatusSchema,
  assignee: z.object({ id: z.string().min(1), name: z.string().min(1) }).optional(),
  history: z.array(requestEventSchema),
  messages: z.array(requestMessageSchema),
  synthetic: z.literal(true),
});
export type CivicRequest = z.infer<typeof civicRequestSchema>;

/**
 * M07 addendum — the local database for onboarding. A demo account is a
 * plain record: who signed up, which branch, which role. It NEVER contains
 * a password — the signup password is validated only and is never stored.
 */
export const onboardingRoleSchema = z.enum([
  'resident',
  'business-owner',
  'bia-coordinator',
  'org-member',
  'city-staff',
]);
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;

export const onboardingBranchSchema = z.enum(['individual', 'organization']);
export type OnboardingBranch = z.infer<typeof onboardingBranchSchema>;

export const onboardingAccountSchema = z.object({
  /** The account key: the email the person signed up with. */
  email: z.string().email(),
  name: z.string().min(1),
  branch: onboardingBranchSchema,
  /** Empty for an individual account. */
  organizationName: z.string(),
  role: onboardingRoleSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type OnboardingAccount = z.infer<typeof onboardingAccountSchema>;

/** Profile and preference settings for the signed-in demo account. */
export const onboardingSettingsSchema = z.object({
  key: z.literal('main'),
  /** Display name, shown on the profile and in Settings. */
  displayName: z.string(),
  showPublicly: z.boolean(),
  shareLocation: z.boolean(),
  largerText: z.boolean(),
  /** The account currently signed in on this device, if any. */
  currentAccountEmail: z.string().nullable(),
});
export type OnboardingSettings = z.infer<typeof onboardingSettingsSchema>;
