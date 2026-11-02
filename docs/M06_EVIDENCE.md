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
| M06-D3 | Fixture `w-ward` points at `ws-ward-sample`, which does not exist, so its "Open in workspace" link shows "Workspace not found" | Open: found while reading fixtures; belongs to the Representative workspace (M07) |
| M06-N1 | The new tenants have no map pins | Open by choice: map fixtures were left unchanged because the map tests pin the Windsor result counts (22). Add pins later and change those tests to derive counts from the fixtures, as M04-D1 did for another count |

## Still team-only before the deposit

- [ ] **Run the real checks** on a team machine: `npm ci`, `npm run check`, and `npm run test:e2e` (needs Chromium). Record the results here.
- [ ] **Teammate review** of this increment (portal rule: no unreviewed generated code). Reviewer: [TEAM]
- [ ] **PR and CI links** in the team repo. Links: [TEAM]
- [ ] **Tag** for M06 in the team repo (portal tag name to be confirmed). Commit: [TEAM]
- [ ] **Weekly controls report** for Week 6. File: [TEAM]
- [ ] **Screenshots** of `/institution`, a school tenant, `/organization`, the Roles & access tab, and the restricted and no-access states. Files: [TEAM]
- [ ] **Clean-clone check** on a team machine. Machine and result: [TEAM]
- [ ] **Leftovers from M02 to M05**: teammate review, recorded demonstrations, PR and CI links, tags, screenshots, clean-clone evidence are still open and are not closed by this increment.
- [ ] **Private team review meeting**: day and time still to be confirmed after kickoff; do not invent a date here.

## Addendum (Nov 1, 2026): request decisions — declined and more information

The client's Week 6 guidance asked what happens when a request is declined or
more information is needed. This was a gap in the Oct 31 increment (tasks only
moved open → in-progress → done), so it was built before the delivery:

- Task statuses gained `declined` and `needs-info`; tasks carry an optional
  `note` recording what happened (decline reason, information requested, or
  information provided).
- New port methods, all requiring the `work` permission and rejecting with
  "Not allowed: ..." otherwise: `declineTask` (from open/in-progress, reason
  required, terminal — a declined request stays closed), `requestTaskInfo`
  (from open/in-progress, note required), `provideTaskInfo` (needs-info →
  open, records what was provided).
- The Tasks tab in every workspace shows Decline / Request info / Provide info
  buttons, role-gated like everything else, with the recorded note displayed
  on each request ("Record: ..."). Restricted workspaces reject these too.
- Checks run Nov 1, 2026 (Node 24.22.1, fresh `npm ci`, this workspace — not a
  clean clone): lint 0 errors, typecheck pass, **114/114 unit tests pass**
  (106 existing + 8 new in `tests/unit/task-decisions.test.ts`), production
  build prerenders all 35 routes.
