import type { MemberRole, WorkspaceKind } from './schemas';

/**
 * M06 per-kind configuration for the one reusable workspace shell. A new
 * tenant type is a new entry here, a few workspace records and (if needed) a
 * route that renders WorkspaceClient. It is never a copy of the shell.
 *
 * M07: there is no 'roles' tab any more. Roles moved out of the workspaces and
 * into onboarding (`src/lib/session.ts`): a person chooses a role when they
 * sign up, and a workspace shows what *that* person can do. The Members tab
 * still lets an owner manage who is in the workspace.
 */
export type WorkspaceTab =
  | 'overview'
  | 'members'
  | 'listings'
  | 'offers'
  | 'programs'
  | 'events'
  | 'requests'
  | 'cases'
  | 'communications'
  | 'public'
  | 'audit'
  | 'tasks';

export interface KindConfig {
  /** Heading above the workspace name. */
  label: string;
  /** Route that renders this kind. Several kinds may share a route. */
  route: '/bia' | '/business' | '/institution' | '/organization' | '/government';
  tabs: { id: WorkspaceTab; label: string }[];
  /** Plain-language role names for this kind. The role ids never change. */
  roleLabels: Record<MemberRole, string>;
  /** Wording for the programs tab (kinds without listings and offers). */
  programs?: { heading: string; help: string; noun: string };
  /** M07 governance merge: kinds that run governed cases, publication states and an audit record. */
  governed?: boolean;
  /** Kind-specific safeguards shown on the Overview tab. */
  safeguards: string[];
}

const COMMON_END: { id: WorkspaceTab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'tasks', label: 'Tasks' },
];

export const KIND_CONFIG: Record<WorkspaceKind, KindConfig> = {
  bia: {
    label: 'BIA / corridor',
    route: '/bia',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'members', label: 'Members' },
      { id: 'listings', label: 'Listings' },
      { id: 'offers', label: 'Offers' },
      { id: 'requests', label: 'Requests' },
      ...COMMON_END,
    ],
    roleLabels: { owner: 'Owner', staff: 'Staff', member: 'Member' },
    safeguards: [],
  },
  business: {
    label: 'Business',
    route: '/business',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'members', label: 'Members' },
      { id: 'listings', label: 'Listings' },
      { id: 'offers', label: 'Offers' },
      { id: 'requests', label: 'Requests' },
      ...COMMON_END,
    ],
    roleLabels: { owner: 'Owner', staff: 'Staff', member: 'Member' },
    safeguards: [],
  },
  institution: {
    label: 'Institution',
    route: '/institution',
    tabs: [
      { id: 'overview', label: 'Dashboard' },
      { id: 'members', label: 'Members' },
      { id: 'programs', label: 'Services & programs' },
      ...COMMON_END,
    ],
    roleLabels: { owner: 'Institution administrator', staff: 'Program staff', member: 'Partner (view only)' },
    programs: {
      heading: 'Services and programs',
      help: 'Drafts stay inside the institution. Only published programs are public, and only a verified institution can publish.',
      noun: 'program',
    },
    safeguards: [
      'Institution content is public information only in this shell: no case files, client records or internal documents.',
    ],
  },
  organization: {
    label: 'Community organization',
    route: '/organization',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'members', label: 'Members & volunteers' },
      { id: 'programs', label: 'Initiatives' },
      ...COMMON_END,
    ],
    roleLabels: { owner: 'Organization lead', staff: 'Coordinator', member: 'Volunteer / member (view only)' },
    programs: {
      heading: 'Initiatives',
      help: 'Drafts stay inside the organization. Only published initiatives are public, and only a verified organization can publish.',
      noun: 'initiative',
    },
    safeguards: [
      'Volunteer names are demo names. No contact details, donations or personal records are held in this shell.',
    ],
  },
  school: {
    label: 'School / education',
    route: '/institution',
    tabs: [
      { id: 'overview', label: 'Dashboard' },
      { id: 'members', label: 'Staff & families' },
      { id: 'programs', label: 'Programs & notices' },
      ...COMMON_END,
    ],
    roleLabels: { owner: 'Principal / administrator', staff: 'Teacher / staff', member: 'Parent or guardian (view only)' },
    programs: {
      heading: 'Programs and notices',
      help: 'Drafts stay inside the school. Only published programs and notices are visible to families, and only a verified school can publish.',
      noun: 'program or notice',
    },
    safeguards: [
      'No student records or student names exist in this shell. Education content is guardian-facing programs and notices only.',
    ],
  },
  government: {
    label: 'Public office / government department',
    route: '/government',
    governed: true,
    tabs: [
      { id: 'overview', label: 'Dashboard' },
      { id: 'cases', label: 'Cases' },
      { id: 'communications', label: 'Communications' },
      { id: 'public', label: 'Public view' },
      { id: 'members', label: 'Members' },
      { id: 'programs', label: 'Services' },
      { id: 'requests', label: 'Requests' },
      ...COMMON_END,
      { id: 'audit', label: 'Audit record' },
    ],
    roleLabels: { owner: 'Department head', staff: 'Department staff', member: 'Partner (view only)' },
    programs: {
      heading: 'Services',
      help: 'Drafts stay inside the department. Only published services are public, and only a verified department can publish.',
      noun: 'service',
    },
    safeguards: [
      'No case files, client records or personal information are held in this shell. Department content is public service information only.',
    ],
  },
};

/** Kinds served by each workspace route (a route can serve several institution types). */
export const ROUTE_KINDS: Record<KindConfig['route'], WorkspaceKind[]> = {
  '/bia': ['bia'],
  '/business': ['business'],
  '/institution': ['institution', 'school'],
  '/organization': ['organization'],
  '/government': ['government'],
};

export const routeForKind = (kind: WorkspaceKind): KindConfig['route'] => KIND_CONFIG[kind].route;

/** Kinds that use the Programs tab instead of listings and offers. */
export const usesPrograms = (kind: WorkspaceKind): boolean => KIND_CONFIG[kind].programs !== undefined;
