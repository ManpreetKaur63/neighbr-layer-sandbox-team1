# M07 evidence: public office & government department workspace

Milestone M07 (Week 7, Nov 2–8, 2026). Milestone intent: "Public office and government department as a governed tenant, with the resident → department → resident journey." Required deliverables: government department workspace, the department as a request handler, task assignment to a named person, and the representative route decision.

Built on 7 November 2026 on top of the Week 6 review-fixes codebase (`neighbr-shell-m01-m06-review-fixes.zip`).

## Honest status first

- **Checks run here, on this code:** `npm run lint` 0 errors; `npm run typecheck` passes; `npm test` **144 of 144 in 17 files** (134 at the M06 review-fixes baseline plus 10 new M07 tests); `npm run build` passes with **36 routes** (34 in `src/lib/routes.ts` plus `/` and `/_not-found`). Playwright (`npm run test:e2e`) and the axe scan were **not run** (no Chromium in this environment), and no page was looked at in a real browser.
- This code was written with AI assistance and has **not been teammate-reviewed**; the portal forbids depositing unreviewed generated code.
- **About the 1 November task-level decline work.** The Week 6 delivery zip built on 1 November added declined / needs-info states to workspace *tasks* (114 tests). That work is **not** in the tree this milestone builds on: the review-fixes tree implements the same client requirement at the *request* layer instead (`RequestPort.handle` + `RequestDetail` — decline, ask for information, resolve, each with a required note, a record entry and a message to the person). The request layer is the canonical mechanism from the M06 review onward; the task-level version was superseded, not lost. Nothing in this milestone re-adds it.

## What was built (M07 increment)

- **One shell, one more tenant type.** `kind` gained `government`. `src/lib/workspace-config.ts` holds its tabs (Dashboard, Members, Services, Requests, Events, Tasks), role names (Department head / Department staff / Partner (view only)), wording and safeguards. No shell code was copied (ADR-016).
- **Government department workspace** (`/government`): Sample City of Windsor — Public Works (verified) and Sample Parks & Recreation (onboarding). Services and programs, members, events, tasks, and a Requests tab. The dashboard shows a "Requests needing attention" card (open requests, who they are assigned to, a button into the Requests tab).
- **The department as a request handler.** The report form (`/issues/report`) now asks "Who should handle it?": the Olde Riverside BIA (only when the place is inside its corridor — the option is disabled outside it, with the reason), Public Works, or Parks & Recreation. The request port already accepted an explicit handler, so no port change was needed. The confirmation names the handler that received it. The full journey works end to end: report → department queue → assign to a named staff member → ask for information / decline / resolve with a note → the person reads it in Messages, gets a notification, sees the map status change, and can follow up to reopen.
- **Task assignment to a named person** already existed for requests (`handle` with `assign`, which also moves a submitted request into review). M07 uses it as the department's assignment step and proves it in tests against the Public Works queue; the workspace Tasks tab keeps its forward-only open → in-progress → done rule.
- **Roles moved out of the workspaces and into onboarding** (ADR-017). There is no "View as" switch and no Roles & access tab anywhere any more. A person chooses a role when they sign up (`/signup`, new step: Resident, Business owner, BIA coordinator, Community organization member, City staff); the role is kept in the browser session only and each workspace resolves it to one of its own members (`src/lib/session.ts`: `getOnboardingRole`, `setOnboardingRole`, `resolveActor`). A resident is not a member of any workspace, so they act with the least privilege everywhere. The role can be changed in Settings. The Members tab still lets an owner manage who is *in* a workspace (invite, change role, accept) — that is team management, not the demo switch. The "Your access" card on every workspace dashboard now says who you are acting as and links to Settings. The M06 request-journey walkthrough was updated: steps that said "View as the coordinator" now say "signed up as BIA coordinator".
- **Representative route decision** (ADR-018). A representative is a person, not an organization, so `/representative` is a profile page, not a workspace: a sample ward councillor (ward, office hours, where reports go) with a link into the Public Works workspace. Route status is "partly built".
- **Map link fixed (closes M06-D3).** The ward office fixture (`w-ward`) pointed at `ws-ward-sample`, which did not exist, so its "Open in workspace" link showed "Workspace not found". It now points at the Public Works department, and `workspaceHrefForObject` routes `ws-gov-…` ids to `/government`.
- **Also touched:** `SiteHeader` (Government link), `/signup` done state (role-based workspace link), `/settings` (Your role section), `routes.ts` (34 routes: 20 built, 4 partly built, 10 stubs), ROUTE_MATRIX, ARCHITECTURE (ADR-016, ADR-017, ADR-018), CHANGELOG, README.

## Object and state coverage matrix

| Object / state | Where | Covered how |
| --- | --- | --- |
| Government workspace (verified) | `/government` | Public Works: dashboard, members (incl. an invited inspector), services (one published, one draft), requests, events, tasks |
| Government workspace (onboarding) | `/government?ws=ws-gov-parks` | Parks & Recreation: onboarding banner, drafts cannot publish |
| Request routed to a department | `/issues/report` → `/government` Requests tab | Report form handler choice; port accepts explicit `workspaceId`; tests cover create + assign + resolve + map write-back |
| Request declined / more information needed | `/government` Requests tab, `/messages` | Same `RequestPort.handle` rules as the BIA journey; note required; record entry; message to the person |
| No-permission attempt | Any workspace | The onboarded role decides: a resident (view only) sees disabled controls with the reason; the port rejects with "Not allowed: ..." |
| Role chosen at signup | `/signup` | Role step (5 roles, plain descriptions); review shows the role; done links to the role's workspace; role kept in session only |
| Role changed after signup | `/settings` | "Your role" section; changing it changes what workspaces allow for the session |
| Representative | `/representative` | Profile page; links to Public Works and to the report form |
| Ward office on the map | `/map?sel=w-ward` | "Open in workspace" now opens `/government?ws=ws-gov-public-works` |

## Route delta

| Route | Before | After |
| --- | --- | --- |
| `/government` | did not exist | Built (M07) |
| `/representative` | Stub | Partly built: profile page, not a workspace |
| `/issues/report` | Built (BIA routing only) | Built (handler choice: BIA or department) |
| `/signup` | Built | Built (role step added) |
| `/settings` | Built | Built ("Your role" section added) |
| `/institution`, `/organization` | Built (with Roles tab) | Built (Roles tab removed) |
| `/bia`, `/business` | Built (with Roles tab) | Built (Roles tab removed) |

Route inventory: **34 routes: 20 built, 4 partly built, 10 stubs** (M06 review-fixes: 33 routes, 19 / 3 / 11).

## Defects and notes

| ID | Description | Status |
| --- | --- | --- |
| M06-D3 | Fixture `w-ward` pointed at `ws-ward-sample`, which did not exist | **Fixed in M07:** points at `ws-gov-public-works`; `workspaceHrefForObject` routes `ws-gov-…` ids to `/government`; covered by `m07-government-roles.test.ts` |
| M06-N1 | The new tenants have no map pins | Still open by choice: the government tenants have no pins either. Add pins later and change the map tests that pin the Windsor result counts (22), as M04-D1 did for another count |
| M07-D1 | The report form offers Parks & Recreation even though it is onboarding (not verified) | Accepted for the demo: an onboarding department can receive requests and work them; it cannot publish. The option says so in its hint |
| M07-D2 | A role change in Settings only takes effect when a workspace page loads (the role is read on mount) | Accepted for the demo: navigating to a workspace re-reads it. A live role switch inside an open workspace is not built |
| M07-N1 | The department has no boundary: reports are routed by the person's explicit choice, not by geography | Open: a department service area (like the BIA corridor) is M08 territory. The BIA boundary rule is unchanged |

## Checklist (state on 7 November 2026)

Verified in the build environment:

- [x] `npm run lint` (0 errors), `npm run typecheck`, 144 of 144 unit tests, production build (36 routes)
- [x] Government workspace renders from the same shell (config entry + seeds only)
- [x] Resident → Public Works → resident request journey works through the port (create, assign, resolve, map write-back) and is covered by tests
- [x] Roles: chosen at signup, resolved per workspace, changeable in Settings; no "View as" switch and no Roles tab remain in the code
- [x] Demo video: `Week7_Demo.mp4` (71s, 13 screens) + `Week7_Demo_Walkthrough.html`, recorded 7 Nov 2026 from the real prototype with `docs/evidence/m07/record-week7-demo.mjs`; frames in `docs/evidence/m07/shots/`

## M07 addendum — local database for onboarding (7 Nov 2026)

Signup used to save nothing. It now saves the demo account in the browser's local database (IndexedDB, `src/lib/onboarding-db.ts`): database `neighbr-demo`, version 1, stores `accounts` (key: email) and `settings` (one record, key `main`). No new runtime dependency; `fake-indexeddb` was added as a devDependency so the tests exercise the real IndexedDB path.

- **Stored:** name, email, branch, organization name, role, created/updated dates; settings (display name, show publicly, share location, larger text, which account is signed in). **Never stored:** the password — signup validates it and throws it away.
- **Used by:** `/signup` (saves the account and marks it signed in), `/signin` (looks the email up; a missing email gets a plain "No account with this email" state instead of a fake success), `/profile` (shows the saved account, or the fixed demo profile when none exists; privacy toggles save there), `/settings` (display name, role, toggles, and a "Clear demo data" section that empties both stores).
- **Fallback:** when IndexedDB is unavailable (private mode, blocked storage) the same calls use plain in-memory maps and report where the data went, so the UI never pretends a save persisted.
- **Checks:** 17 new tests (`onboarding-db.test.ts` 13, sign-in and signup UI 4) — round-trip, current account, role change, settings, invalid records discarded, clear, memory fallback, and a signup flow that proves the password is not in the stored record. Full run: lint 0, typecheck pass, **161/161 tests**, build 36/36 routes.
- **Open:** the account lives on one device only (no sync), there is still no real authentication, and the request store is still session-only. The email is the account key, so changing it is not supported in Settings.

Still open (needs the team, or was not done):

- [ ] Screenshots of `/government` (both tenants), the signup role step, the Settings role section, and the report form handler choice
- [ ] A short video of the resident → department → resident journey (the Week 6 video pattern, `docs/evidence/m06/record-journey.py`, can be reused)
- [ ] **Playwright end-to-end suite and axe scan** on a machine where they run (`npm run test:e2e`)
- [ ] **Check on a physical phone** (the phone numbers in M06 are from headless Chromium)
- [ ] **Teammate review** of M06 (review-fixes), M07 and this increment (portal rule: no unreviewed generated code). Reviewer: [TEAM]
- [ ] **PR and CI links** in the team repo. Links: [TEAM]
- [ ] **Tag** for M07 (`week-07-public-office-government`). Commit: [TEAM]
- [ ] **Weekly controls report** for Week 7. File: [TEAM]
- [ ] **Clean-clone check** on a team machine. Machine and result: [TEAM]
- [ ] **Leftovers from M02 to M06** (teammate review, recorded demonstrations, PR and CI links, tags, screenshots, clean-clone evidence) — Week 6's deposit is still LATE and its branch/PR state is unconfirmed; see the Week 7 delivery package
- [ ] **Private team review meeting**: day and time still to be confirmed after kickoff; do not invent a date here.
