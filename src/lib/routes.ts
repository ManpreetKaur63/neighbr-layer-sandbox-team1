// Required route inventory (Project Plan section 4.2). Every route exists from the first build;
// `status` says how much of it is real. Docs and the /status page are generated from this list.

export type RouteFamily = 'Core public' | 'Identity and profile' | 'Community' | 'Institutional' | 'Administration' | 'Delivery support';
export type RouteStatus = 'built' | 'partial' | 'stub';

export interface RouteDef {
  path: string;
  title: string;
  family: RouteFamily;
  /** Milestone in which the route is (or will be) fully implemented. */
  milestone: string;
  status: RouteStatus;
  summary: string;
}

export const ROUTES: RouteDef[] = [
  { path: "/", title: "Welcome", family: "Core public", milestone: "M02", status: "partial", summary: "Public entry and the path onto the shared map." },
  { path: "/map", title: "Shared map", family: "Core public", milestone: "M03", status: "built", summary: "The common map: boundaries, pins, search, filters, detail panels and a list alternative." },
  { path: "/pulse", title: "Civic Pulse", family: "Core public", milestone: "M04", status: "built", summary: "Map-linked feed of posts, issues, updates and outcomes." },
  { path: "/alerts", title: "Alerts", family: "Core public", milestone: "M04", status: "built", summary: "Approved public alerts tied to places." },
  { path: "/polls", title: "Polls", family: "Core public", milestone: "M04", status: "built", summary: "Polls with audience rules for residents and visitors." },
  { path: "/polls/create", title: "Create a poll", family: "Core public", milestone: "M04", status: "built", summary: "Poll authoring for authorized organizations." },
  { path: "/issues/report", title: "Report an issue", family: "Core public", milestone: "M04", status: "built", summary: "Report a local issue and follow its outcome." },
  { path: "/beacon", title: "Beacon", family: "Core public", milestone: "M03", status: "partial", summary: "Assistant placement and interaction shell. The map reserves its slot; no protected logic." },
  { path: "/signin", title: "Sign in", family: "Identity and profile", milestone: "M02", status: "built", summary: "Sign-in shell: pending, denied, expired and recovery states (demo only, no real auth)." },
  { path: "/signup", title: "Sign up", family: "Identity and profile", milestone: "M02", status: "built", summary: "Account-creation shell with individual and organization branches and onboarding journeys (demo only)." },
  { path: "/profile", title: "Profile", family: "Identity and profile", milestone: "M02", status: "built", summary: "Fixed-type demo profile with privacy controls." },
  { path: "/settings", title: "Settings", family: "Identity and profile", milestone: "M02", status: "built", summary: "Account, privacy and accessibility settings shells (demo only, nothing stored)." },
  { path: "/notifications", title: "Notifications", family: "Identity and profile", milestone: "M04", status: "built", summary: "Notifications and saved activity." },
  { path: "/groups", title: "Groups", family: "Community", milestone: "M04", status: "stub", summary: "Neighbourhood groups and issue groups." },
  { path: "/events", title: "Events", family: "Community", milestone: "M05", status: "built", summary: "Local events with map deep links; same events appear in workspace Events tabs." },
  { path: "/messages", title: "Messages", family: "Community", milestone: "M04", status: "stub", summary: "Chats and direct messages." },
  { path: "/marketplace", title: "Marketplace", family: "Community", milestone: "M04", status: "stub", summary: "Local offers. Addresses are shared on request." },
  { path: "/businesses", title: "Businesses", family: "Community", milestone: "M05", status: "built", summary: "Directory of business profiles with claim state and workspace links." },
  { path: "/institution", title: "Institution workspace", family: "Institutional", milestone: "M06", status: "stub", summary: "Workspace for institutions." },
  { path: "/organization", title: "Organization workspace", family: "Institutional", milestone: "M06", status: "stub", summary: "Workspace for community organizations and NGOs." },
  { path: "/representative", title: "Representative workspace", family: "Institutional", milestone: "M07", status: "stub", summary: "Workspace for public offices and representatives." },
  { path: "/business", title: "Business workspace", family: "Institutional", milestone: "M05", status: "built", summary: "Business dashboard: members, claimed listings, offers, events and work queue." },
  { path: "/bia", title: "BIA workspace", family: "Institutional", milestone: "M05", status: "built", summary: "Corridor workspace: dashboard, members, listings, offers, events, tasks and the signal loop." },
  { path: "/admin", title: "Operations", family: "Administration", milestone: "M08", status: "stub", summary: "Operations shell home." },
  { path: "/admin/users", title: "Operations: users", family: "Administration", milestone: "M08", status: "stub", summary: "User and tenant review states." },
  { path: "/admin/content", title: "Operations: content", family: "Administration", milestone: "M08", status: "stub", summary: "Moderation and support queues." },
  { path: "/admin/audit", title: "Operations: audit", family: "Administration", milestone: "M08", status: "stub", summary: "Event ledger and audit viewer." },
  { path: "/admin/system", title: "Operations: system", family: "Administration", milestone: "M08", status: "stub", summary: "Configuration and system-health placeholders." },
  { path: "/help", title: "Help", family: "Delivery support", milestone: "M09", status: "stub", summary: "Help and guidance." },
  { path: "/privacy", title: "Privacy", family: "Delivery support", milestone: "M09", status: "stub", summary: "Privacy notice for the demonstration shell." },
  { path: "/terms", title: "Terms", family: "Delivery support", milestone: "M09", status: "stub", summary: "Terms for the demonstration shell." },
  { path: "/accessibility", title: "Accessibility", family: "Delivery support", milestone: "M09", status: "stub", summary: "Accessibility statement and known limitations." },
  { path: "/status", title: "Build status", family: "Delivery support", milestone: "M03", status: "built", summary: "Route coverage for this build." },
];

export const findRoute = (path: string) => ROUTES.find((r) => r.path === path);
