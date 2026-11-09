# M06 evidence: institution, community organization and school workspaces

Milestone M06 (Week 6, Oct 26–Nov 1, 2026). Milestone intent: "Extend the reusable tenant pattern across organization types." Required deliverables: institution dashboard shell, community organization workspace, school/education workspace, role and permission-state demonstrations.

Built on 31 October 2026 on top of the merged M01–M05 codebase (`neighbr-shell-m01-m05-merged.zip`).

## Honest status first

- **Not run in a full toolchain.** The build environment had no network access, so `npm ci` could not complete. **Lint, strict typecheck, the full Vitest suite, the production build and Playwright were not run.** They must be run on a team machine before anything is deposited (`npm ci`, then `npm run check`).
- What was checked here, and how:

| Check | How | Result |
| --- | --- | --- |
| Syntax of every `.ts` and `.tsx` file | TypeScript compiler, transpile only | 0 errors (this is not a typecheck) |
| Port, permission rule and tenant configuration logic | 40 tests run on Node 22.22.2 with a minimal stand-in test runner and a pass-through stand-in for Zod (the real Zod validation of the new seed records did not run) | 40 of 40 passed: the 29 new M06 tests plus the 11 existing M05 `workspace-port.test.ts` tests, unchanged |
| Route inventory count | script over `src/lib/routes.ts` | 33 routes: 18 built, 2 partly built, 13 stubs (M05: 16 / 2 / 15) |
| Pages in a browser | not done | not claimed |

- The new test files use the same Vitest API as the rest of the suite. If the real run disagrees with the stand-in, trust the real run and record a defect.
- Expected total once the real suite is run: 13 files, 106 tests (77 at M05 plus 29 new). This is an expectation, not a result.
- This code was generated with AI assistance and has **not been teammate-reviewed**; the portal forbids depositing unreviewed generated code.

## Update, 1 November 2026: checks now run

The checks listed above as not run were run later on a machine with network access. On the M06 code **before** the request journey changes: lint 0 errors, typecheck pass, 106 of 106 tests. After the request journey changes (`docs/M06_REQUEST_JOURNEY.md`): lint 0, typecheck pass, 127 of 127 tests, `npm run build` passes with 35 routes. Playwright and the axe scan were still not run (no Chromium), and no page was looked at in a real browser. Teammate review is still open.

## Update, 2 November 2026: review feedback (boundary, mobile, connected steps, evidence)

| Request | Finding | Change | Verified how |
| --- | --- | --- | --- |
| BIA directory should show only businesses inside its boundary | **Was missing:** the BIA listed every business and place in the city (8 in Windsor) | The BIA workspace carries a `boundaryId`; its listings, events and counts use `pointInPolygon` (`src/lib/geo.ts`) against that boundary; if the boundary is missing it shows nothing | `bia-boundary.test.ts`; real browser: "4 of the 8", Listings shows 4 (screens 01, 02) |
| Mobile map should have more space | **Was missing:** on 390x844 the map had about 20% of the screen (9% on 360x640) | Two-row phone header, sheet about a third of the screen (title bar only when hidden), who-you-are chip floats under the header, region text hidden visually but kept in the button name | Measured in a real browser: **42%** at 390x844, **36%** at 360x640 (screens 24, 25). Not tested on a physical phone |
| Changes carry across screens | Shared store existed but reports were lost on a full page load; a report outside any workspace was lost; **all reports were placed outside the corridor and routed by city, not area** | Store saved in session storage (read and write guarded); `reportIssue` shares the issue with other pages; the report form asks "Where is it?"; a located issue goes only to the BIA whose boundary contains it, otherwise stays on the map with a clear message | `bia-boundary.test.ts`; full journey in a real browser with full page loads (screens 03 to 17, video) |
| Screenshots and video | Missing | `docs/evidence/m06/` (26 screenshots, 72-second video, the script) | Captured from the production build |

Checks run on the modified code (Node 22.22.2): `npm run lint` 0 errors; `npm run typecheck` passes; `npm test` **134 of 134 in 16 files** (127 before plus 7 new); `npm run build` passes. Two existing tests changed because behaviour changed on purpose: the request-port helper now reports from inside the corridor, and the store-isolation test passes separate stores. Playwright (`npm run test:e2e`) and the axe scan were **not run**.

Known limits of this change: the session store is per browser tab and resets when the tab closes; "Where is it?" offers two sample places (no real geocoding); the corridor polygon is an illustrative placeholder; a request created with no location falls back to the city's verified BIA (older callers).

## What was built (M06 increment)

- **One shell, three more tenant types.** `kind` gained `institution`, `organization` and `school`. `src/lib/workspace-config.ts` holds per-kind tabs, role names, wording and safeguards; `WorkspaceShell` and `WorkspaceClient` read from it. No shell code was copied (ADR-014).
- **Institution dashboard shell** (`/institution`): Sample Riverside Public Library, verified. Dashboard tiles (members, published, awaiting publication, open tasks, events), an "Awaiting publication" list with Publish controls, services and programs, members, events and tasks.
- **School / education workspace** (`/institution?ws=ws-school-elementary`, `?ws=ws-school-academy`): an elementary school (verified) and a language academy (restricted, read-only). Guardian-facing programs and notices only; no student records or student names exist anywhere in the fixtures.
- **Community organization workspace** (`/organization`): Neighbours Association (verified) and Friends of the Trail (onboarding). Initiatives, members and volunteers, events and tasks; initiatives can link to existing map objects (garden, walk, trail).
- **Role and permission-state demonstrations** (ADR-015, `docs/M06_ROLES_AND_PERMISSIONS.md`): one pure rule `decide`; a **View as** switch on every workspace; a Roles & access tab on every workspace (including BIA and Business) with a role matrix, an access-state matrix and a reason for each decision; disabled controls explain themselves; an invited person sees "No access yet".
- **Port additions:** `programs`, `createProgram`, `publishProgram`, `inviteMember`, `changeMemberRole` (never leaves a workspace without an active owner), `acceptInvite`. Every mutating method takes an optional actor and rejects with "Not allowed: ...". A restricted workspace now rejects every change.
- **Also touched:** `SiteHeader` (Institution and Organization links), `/signup` done state (links to the new workspaces), `/status` text, `routes.ts` (two routes now built), ROUTE_MATRIX, ARCHITECTURE (ADR-014, ADR-015), RAID, CHANGELOG, README.

## Object and state coverage matrix

| Surface | States covered | Notes |
| --- | --- | --- |
| `/institution`, `/organization` | loading, error (unknown `?ws=` or a workspace of another route), success | an unknown id shows "Workspace not found" |
| Verified tenant | success, all four actions by role | owner, staff, member |
| Onboarding tenant | success; publish unavailable | `ws-org-trail` |
| Restricted tenant | success, read-only for everyone | `ws-school-academy` |
| Invited person | no access | every tenant has one |
| Programs tab | success, empty ("Nothing here yet"), error (inline) | draft then publish, gated on verification and role |
| Members tab | success, error (inline) | invite, accept (demo), role change, last-owner guard |
| Roles & access tab | success | readable by an invited person |

## Defect and change records

| ID | Description | Status |
| --- | --- | --- |
| M06-D1 | `restricted` workspaces had a badge but no behaviour (recorded in M05 config §3) | Fixed: the port rejects every change in a restricted workspace; tests cover it |
| M06-D2 | Role checks were display-only (M05-D3) | Fixed for the mock port (actor-aware, one shared rule). Open for production: there is no authentication, so "View as" is a demonstration |
| M06-D3 | Fixture `w-ward` points at `ws-ward-sample`, which does not exist, so its "Open in workspace" link shows "Workspace not found" | **Fixed in M07:** the fixture now points at `ws-gov-public-works`, and `workspaceHrefForObject` routes `ws-gov-…` ids to `/government` (test: `m07-government-roles.test.ts`) |
| M06-N1 | The new tenants have no map pins | Open by choice: map fixtures were left unchanged because the map tests pin the Windsor result counts (22). Add pins later and change those tests to derive counts from the fixtures, as M04-D1 did for another count |

## Checklist (state on 2 November 2026)

Verified in the build environment:

- [x] `npm ci`, lint (0 errors), typecheck, 134 of 134 unit tests, production build
- [x] BIA directory limited to its boundary (tests and real browser)
- [x] Mobile map space measured before and after (20% to 42% at 390x844)
- [x] Full journey, issue to BIA action to visible outcome, clicked through in a real browser with full page loads
- [x] Current screenshots of the BIA and Business workspaces, and a 72-second video (`docs/evidence/m06/`)

Still open (needs the team, or was not done):

- [ ] Screenshots of `/institution`, a school tenant, `/organization`, and the restricted and no-access states
- [ ] **Playwright end-to-end suite and axe scan** on a machine where they run (`npm run test:e2e`)
- [ ] **Check on a physical phone** (the phone numbers above are from headless Chromium)
- [ ] **Teammate review** of M06 and this increment (portal rule: no unreviewed generated code). Reviewer: [TEAM]
- [ ] **PR and CI links** in the team repo. Links: [TEAM]
- [ ] **Tag** for M06 (portal tag name to be confirmed). Commit: [TEAM]
- [ ] **Weekly controls report** for Week 6. File: [TEAM]
- [ ] **Clean-clone check** on a team machine. Machine and result: [TEAM]
- [ ] Browser test record table in `docs/M06_REQUEST_JOURNEY.md` section 5 (people, what they learned, what they changed): [TEAM]
- [ ] **Leftovers from M02 to M05** (teammate review, recorded demonstrations, PR and CI links, tags, screenshots, clean-clone evidence)
- [ ] **Private team review meeting**: day and time still to be confirmed after kickoff; do not invent a date here.
