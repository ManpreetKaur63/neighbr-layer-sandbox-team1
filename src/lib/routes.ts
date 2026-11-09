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
  { path: "/issues/report", title: "Report an issue", family: "Core public", milestone: "M04", status: "built", summary: "Report a local issue, choose who handles it (BIA or a city department, M07), and follow its outcome." },
  { path: "/beacon", title: "Beacon", family: "Core public", milestone: "M03", status: "partial", summary: "Assistant placement and interaction shell. The map reserves its slot; no protected logic." },
  { path: "/signin", title: "Sign in", family: "Identity and profile", milestone: "M02", status: "built", summary: "Sign-in: looks the email up in the local database (M07 addendum); pending, denied, expired and recovery states (demo only, no real auth)." },
  { path: "/signup", title: "Sign up", family: "Identity and profile", milestone: "M02", status: "built", summary: "Account creation with individual and organization branches, a role step (M07) and onboarding journeys; saves the demo account in the local database (M07 addendum)." },
  { path: "/profile", title: "Profile", family: "Identity and profile", milestone: "M02", status: "built", summary: "Shows the saved account when one exists, else the fixed demo profile; privacy controls saved in the local database (M07 addendum)." },
  { path: "/settings", title: "Settings", family: "Identity and profile", milestone: "M02", status: "built", summary: "Account, privacy, accessibility and your onboarding role (M07) settings, all saved in the local database, with a clear-demo-data section (M07 addendum)." },
  { path: "/notifications", title: "Notifications", family: "Identity and profile", milestone: "M04", status: "built", summary: "Notifications and saved activity." },
  { path: "/groups", title: "Groups", family: "Community", milestone: "M04", status: "stub", summary: "Neighbourhood groups and issue groups." },
  { path: "/events", title: "Events", family: "Community", milestone: "M05", status: "built", summary: "Local events with map deep links; same events appear in workspace Events tabs." },
  { path: "/messages", title: "Messages", family: "Community", milestone: "M04", status: "partial", summary: "Your requests and the replies from the organizations handling them: status, who can see it, record of what happened, reply and follow-up. Direct and group chats are not built." },
  { path: "/marketplace", title: "Marketplace", family: "Community", milestone: "M04", status: "built", summary: "Published offers from business workspaces. Addresses are shared on request, through a request the business answers in Messages." },
  { path: "/businesses", title: "Businesses", family: "Community", milestone: "M05", status: "built", summary: "Directory of business profiles with claim state and workspace links." },
  { path: "/institution", title: "Institution workspace", family: "Institutional", milestone: "M06", status: "built", summary: "Institution dashboard and school/education workspace: members, programs, events, tasks, and access states." },
  { path: "/organization", title: "Organization workspace", family: "Institutional", milestone: "M06", status: "built", summary: "Community organization workspace: members and volunteers, initiatives, events, tasks, and access states." },
  { path: "/government", title: "Government department workspace", family: "Institutional", milestone: "M07", status: "built", summary: "Public office / government department workspace: members, services, requests, events and tasks. Reports route here from the map." },
  { path: "/representative", title: "Representative", family: "Institutional", milestone: "M07", status: "partial", summary: "Sample ward representative profile: ward, office and where reports go. Representatives are people, not workspaces (M07 decision)." },
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
