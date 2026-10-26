# Changelog

## Unreleased — M01–M05 merged codebase

This merge keeps, in one codebase: M01 delivery foundation (repo structure, CI, route inventory, evidence index templates), M02 entry and profiles (built here as a backfill — see below), M03 map environment, M04 social layer, and M05 BIA and Business workspaces. Nothing from the uploaded M04 zip was lost: that zip is byte-identical to the M04 delivery the M05 work was already built on, so the merge is M04 + M05 + the new M02 shells, not a replacement of either.

### M02 backfill — Entry, Onboarding & Fixed Profiles (built 25 Oct 2026; portal week ended 4 Oct 2026, so this part is LATE — never backdated)
- `/signin` shell: form validation plus pending, denied, expired, recovery and success states, all previewable. Demo only — no account is checked and no password is sent anywhere.
- `/signup` shell: individual and organization branches, details with validation, review step, and a done state that links onward to `/profile`, `/map`, and (for organizations) `/bia` and `/business`. No account is created.
- `/profile` shell: fixed demo profile from the mock session (Demo resident, Windsor) with privacy toggles held in page state only. City switching on the map still creates visitor context, not profile conversion.
- `/settings` shell: account, privacy and accessibility groups with success and error states. Nothing is stored.
- Shared, tested rules in `src/lib/identity.ts` (`validateEmail`, `validatePassword`, `validateSignIn`, `validateSignUp`, `onboardingSteps`); 5 new tests, 77 total passing. Route matrix now 16 built / 2 partly built / 15 stubs.
- Honest limit, unchanged from the M02 plan: there is still no real authentication, account storage or profile persistence — these are shells the identity service will replace.

## Unreleased — M05 BIA and Business tenant workspaces (tag `m05-bia-business`)
- Governed workspace layer: new `WorkspacePort` (workspaces, members, tasks, offers, publish, claim); mock keeps state in memory per session, isolated per factory instance.
- Schemas: `Workspace`, `WorkspaceMember`, `WorkspaceTask`, `WorkspaceOffer`; access states onboarding/verified/restricted.
- One reusable shell (`WorkspaceShell` + `WorkspaceClient`) for both environments: `/bia` (Sample Olde Riverside BIA, verified) and `/business` (Sample Riverside Bakery, verified; Sample Hardware & Garden, onboarding; `?ws=` selects the tenant).
- Views: dashboard, members with roles, corridor/claimed listings with claim flow, draft→publish offers (publish gated on verification), events, forward-only work queue.
- Cross-journeys: workspace listings/events → `/map?sel=`; map detail panel → "Open in workspace" (`/bia?ws=` / `/business?ws=`), both via one helper (`src/lib/workspace.ts`).
- Bounded signal loop on `/bia`: community issue → BIA task → demo outcome card, shown only once the task is marked done.
- Public `/businesses` directory with claim state, and public `/events` page (deferred from M04, built here).
- Route matrix and `/status` updated; 72 unit/component tests pass (11 new in M05).
- Deferred (still stubs, honest in the route inventory): groups, messages, marketplace; messages/documents/analytics placeholders only.

## M04 map based social and civic activity (tag `m04community`)
- Social layer: new `SocialPort` (like/unlike, comments, save/unsave, follow/unfollow,
  notifications, poll voting, issue reporting, poll creation); mock keeps state in
  memory per session, isolated per factory instance.
- Schemas: `SocialComment`, `NotificationItem`; poll voting detail on `CivicObject`;
  new `alert` civic kind (2 Windsor alerts in fixtures; 29 objects total).
- New pages: `/pulse` (map-linked feed with like/comment/save and "View on map" deep
  links), `/polls` (voting with counts), `/polls/create`, `/issues/report`, `/alerts`,
  `/notifications`. Loading/empty/error/success on every page via `StateBoundary`.
- Cross-map integration tests (`map-link.test.ts`) pin the feed→map `?sel=` contract.
- Route matrix and `/status` updated; 61 unit/component tests pass.
- Deferred (still stubs, honest in the route inventory): groups, events, messages, marketplace.

## 0.3.0 — M03 Layer 1 map environment (tag `m03-map`)
- Shared map: MapLibre behind a `MapPort` adapter, illustrative area outlines, clustered pins, selection ring.
- Search, kind filters, Social / Civic pulse / Combined lens, city switch with visitor context.
- Results list as a keyboard-friendly alternative to the map, detail panel, boundary trust notes.
- One-panel-at-a-time layout; bottom sheet on phones; reserved Beacon slot.
- Loading, empty, error and restricted states via `StateBoundary`; `?demo=loading|error|empty` switches.
- Every required route exists (stubs carry their milestone); `/status` shows coverage.
- Service ports with mock adapters over Zod-validated synthetic fixtures.
- 40 unit/component tests, 12 end-to-end tests including an axe scan, CI workflow.

## Foundation (M01 work needed for M03)
- Next.js + TypeScript (strict), design tokens, lint, typecheck, CI, PR and issue templates.
