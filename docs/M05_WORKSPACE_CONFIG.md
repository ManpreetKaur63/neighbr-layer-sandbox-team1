# M05 workspace configuration plan

Week 5 deposit record: how the reusable Layer 2 workspace shell is configured
into BIA and Business environments, and how M06/M07 configure from the same shell.

## 1. The reusable shell (shared, not copied)

One component (`src/components/WorkspaceShell.tsx`) + one service port
(`WorkspacePort`) + one client (`src/components/WorkspaceClient.tsx`) serve
every tenant kind. A new tenant kind adds a workspace record and, if needed, a
route that renders the same client with a different `kind` — it does not copy
the shell.

Shared pieces, in every environment:

| Piece | Where | Notes |
| --- | --- | --- |
| Tenant navigation | `WorkspaceShell` tabs | Overview, Members, Listings, Offers, Events, Tasks |
| Dashboard | Overview tab | Member, listing, open-task and published-offer counts |
| Verified profile | Workspace record | Name, city, summary, status badge |
| Map slot | Cross-journey links | Listings/events → `/map?sel=`; map detail → workspace |
| Staff and permissions | Members tab | Role table (see §3); enforcement is a production-service job |
| Content | Listings, Offers, Events tabs | All synthetic, all labelled demo data |
| Work queue | Tasks tab | Forward-only status (open → in-progress → done) |
| Messages, notifications, documents, analytics | Not built | Placeholders in the plan only — do not claim them as built |

## 2. The two configured environments

| | BIA / corridor (`/bia`) | Business (`/business`) |
| --- | --- | --- |
| Workspace id(s) | `ws-bia-sample` | `ws-biz-bakery`, `ws-biz-hardware` |
| Status | verified | bakery verified; hardware onboarding |
| City | Windsor | Windsor |
| Listings view | Full corridor directory (business + place) | Claimed listings + claimable unclaimed businesses |
| Offers view | Workspace offers (none seeded for BIA) | Bakery published offer; hardware draft (unpublishable until verified) |
| Events view | Windsor events | Windsor events |
| Tasks | Vacancy follow-up, city-works tracking, market update | Listing hours, offer publishing, listing completion |
| Signal loop | Yes — issue → BIA task → demo outcome (§4) | No (businesses are the loop's outcome side, via listings/offers) |
| Tenant switch | Single tenant; `?ws=` must name `ws-bia-sample` | Switcher between the two business tenants; `?ws=` selects |

No default workspace: a page with no `?ws=` uses the first workspace of its
kind, and a `?ws=` naming another kind (or nothing) shows "Workspace not
found". There is deliberately no fallback that silently picks a tenant.

## 3. Access-state and role matrix

| Role | View dashboard/listings/events | Work on tasks, draft offers | Publish offers | Manage members |
| --- | --- | --- | --- | --- |
| Owner | yes | yes | yes (if workspace verified) | yes |
| Staff | yes | yes | yes (if workspace verified) | no |
| Member | yes | no | no | no |

Workspace status gates (enforced in the mock port, tested):

- `onboarding`: listings, tasks and draft offers allowed; publishing rejected.
- `verified`: full tenant behaviour above.
- `restricted`: no behaviour built yet; the badge exists so the state is visible.

Claim rule: a business listing with no `workspaceId` can be claimed into one
workspace; a listing already claimed by another workspace rejects a second
claim. The public directory (`/businesses`) only displays claim state.

## 4. Bounded BIA–Business–community signal loop (trace)

1. Community signal: issue `w-roadworks` — "Roadworks affecting shop access"
   (map pin, `/map?sel=w-roadworks`).
2. Workspace action: BIA task `t-bia-works` — "Track roadworks affecting shop
   access" (starts `in-progress`).
3. Published demo outcome: appears on `/bia` Overview only after that task is
   marked `done` in the session; it points to the market alert on the map.
   Until then the outcome slot honestly says nothing is published yet.

Signal history (this session, synthetic): no real signal was received, no real
business was notified, and no real outcome was published. The loop proves the
plumbing, not a civic result.

## 5. Reuse for M06/M07

M06 (Institution, community organisation, school) and M07 (Public Office,
government department) configure from this shell by adding workspace records
of a new kind and a route rendering `WorkspaceClient` with that kind — plus
whatever their manifest adds (e.g. different tab sets). Do not fork
`WorkspaceShell` per tenant: divergence is how the shared framework breaks.

## 6. Known limitations (do not hide these at review)

- No authentication, no real role enforcement, no messages/documents/analytics.
- All data is synthetic and in-memory per session; claims, tasks and offers
  reset on reload and are not shared between browsers.
- The public marketplace (`/marketplace`) is still a stub: workspace offers
  are not a public marketplace.
- Groups and messages remain M04 stubs.
