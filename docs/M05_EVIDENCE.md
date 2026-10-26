# M05 evidence: BIA and Business tenant workspaces

Milestone M05 (Week 5, Oct 19–25, 2026). Milestone intent: "Build governed
workspaces for local business activity." Review decision sought (Master Table):
"Layer 2 reference framework established."

Checks below were run in this workspace on Node 24.22.1, 25 October 2026.
A clean-clone check on a team machine is still a team-only item below — it is
not claimed here.
The shared Claude chat used as the Week 5 source is a copy of a chat shared by
Manpreet Kaur; its Week 5 block lists the same four deliverables below and is
marked 0/4 verified in that snapshot. That chat does **not** contain a finished,
verified M05 delivery to copy: its final M05 response did not load in the shared
view and its attached files are hidden when shared. This increment was therefore
built fresh in the team's own codebase (M03 map + M04 social layer), not taken
from that chat's unverified progress notes. Do not claim the other chat's
test counts or record counts as this delivery's evidence.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (strict, includes tests) | pass |
| Unit and component tests | `npm test` | 10 files, 72 tests passed (61 in M04 + 11 new in M05) |
| Production build | `npm run build` | compiled; all 35 routes prerendered, including `/bia`, `/business`, `/businesses`, `/events` |

## What was built (M05 increment)

- **Governed workspace layer**: new `WorkspacePort` in `src/services/ports`
  (workspaces, members, tasks, offers, publish, claim). UI talks only to the
  port; the mock keeps state in memory per session, isolated per factory
  instance (as in M04).
- **Schemas** (`src/lib/schemas.ts`): `Workspace` (kind `bia`/`business`,
  status `onboarding`/`verified`/`restricted`), `WorkspaceMember` (role
  `owner`/`staff`/`member`, status `active`/`invited`), `WorkspaceTask`
  (kind listing/offer/event/vacancy/city-works/general, status
  open/in-progress/done), `WorkspaceOffer` (draft/published/expired).
- **One reusable shell** (`src/components/WorkspaceShell.tsx`): same header,
  tenant navigation (Overview, Members, Listings, Offers, Events, Tasks) and
  access-state banner for BIA and Business. Kind changes configuration only,
  never layout code — this is the framework M06/M07 configure from.
- **Two environments from that shell**:
  - `/bia` — Sample Olde Riverside BIA (verified, Windsor): corridor
    dashboard, members, corridor listings, offers, events, work queue.
  - `/business` — Sample Riverside Bakery (verified) and Sample Hardware &
    Garden (onboarding), switchable by tenant; `?ws=` selects the tenant.
- **Tenant navigation and member views**: member lists with role and
  invited/active state, plus a plain-language role table (owners manage,
  staff work, members view). Role checks are display-only in this shell; a
  production workspace service enforces them — see Known limitations.
- **Listings, offers, events and task views**:
  - Listings: BIA corridor directory; Business claimed listings plus
    claimable unclaimed businesses in the same city.
  - Offers: draft creation; publishing gated on verification (an onboarding
    workspace's draft cannot publish — enforced in the port, tested).
  - Events: city events inside each workspace and as a public `/events` page
    (deferred from M04, built here).
  - Tasks: work queue that moves one step forward only (open →
    in-progress → done); done tasks cannot move back.
- **Member/claim flow**: claiming a business listing moves it into one
  workspace; a second workspace claiming the same listing is rejected.
  The public directory `/businesses` shows claim state but never claims —
  claiming is a workspace action.
- **Cross-journeys**: every workspace listing and event links to
  `/map?sel=<id>`; the map detail panel shows "Open in workspace" for owned
  records (`/bia?ws=…` / `/business?ws=…`); both directions share one helper
  (`src/lib/workspace.ts`), pinned by tests.
- **Bounded signal loop** (BIA–Business–community): community issue
  "Roadworks affecting shop access" → BIA task "Track roadworks affecting
  shop access" → demo outcome card, which appears only once that task is
  marked done in the session. The outcome is labelled a demo outcome; it is
  not a real civic outcome.

## Object and state coverage matrix

| Object / surface | States covered | Notes |
| --- | --- | --- |
| `/bia`, `/business` dashboards | loading, empty (via not-found), error, success | unknown `?ws=` shows "Workspace not found" |
| Members view | success | invited vs active; demo names only |
| Listings view | success, error | claim errors shown inline |
| Offers view | success, error | publish blocked for onboarding workspaces |
| Events view (`/events` + workspace tab) | loading, empty, error, success | retry on error |
| Tasks view | success, error | invalid transitions rejected by the port |
| Map detail ↔ workspace | success | `ws` / `sel` deep links round-trip |
| Groups, messages, marketplace | stub (unchanged) | deferred; route inventory says so honestly |

## Defect and change records

| ID | Description | Status |
| --- | --- | --- |
| M05-D1 | Publish gate was UI-only in the first draft; an onboarding workspace could still publish through the port | Fixed: port rejects publish from a non-verified workspace; test covers it |
| M05-D2 | Groups, messages, marketplace remain stubs (as in M04-D3) | Open: deferred; marketplace offers are workspace offers, not a public marketplace |
| M05-D3 | Role checks are display-only in the shell (no auth in this codebase) | Open: production workspace service must enforce roles; recorded in config doc |

## Still team-only before the deposit

- [ ] **Teammate review** of this increment (portal rule: no unreviewed generated code). Reviewer: [TEAM]
- [ ] **PR and CI links** in the team repo. Links: [TEAM]
- [ ] **Tag `m05-bia-business`** in the team repo. Commit: [TEAM]
- [ ] **Weekly controls report** for Week 5. File: [TEAM]
- [ ] **Screenshots** of `/bia`, `/business`, `/businesses` and a map→workspace journey. Files: [TEAM]
- [ ] **Clean-clone check** on a team machine. Machine/result: [TEAM]
- [ ] **M04 leftovers**: teammate review, recorded Gate 2 demo, PR/CI links, tag `m04community`, screenshots, clean-clone evidence — still open from M04, not closed by this increment.
- [ ] **Private team review meeting**: day and time still to be confirmed (per the Week 5 block); do not invent a date here.
