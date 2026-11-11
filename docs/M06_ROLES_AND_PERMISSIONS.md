# M06 roles and permission states

> **Superseded in M07 (7 November 2026).** Roles moved out of the workspaces and into onboarding: there is no "View as" switch and no Roles & access tab any more. A person chooses a role at signup (`src/lib/session.ts`); the role can be changed in Settings. The permission rule (`decide`) itself is unchanged. This document is the Week 6 record of how the M06 demonstration worked; see `docs/M07_EVIDENCE.md` for what replaced it.

Week 6 deposit record: how the reusable workspace shell is configured for institution, school and community organization tenants, and how roles and access states are demonstrated. Read with `docs/M05_WORKSPACE_CONFIG.md`, which describes the shell itself.

## 1. Configuring a new tenant type (what M06 did three times)

| Step | Where | Institution | School | Community organization |
| --- | --- | --- | --- | --- |
| Add the kind | `workspaceKindSchema` in `src/lib/schemas.ts` | `institution` | `school` | `organization` |
| Configure it | `KIND_CONFIG` in `src/lib/workspace-config.ts` | Dashboard, Members, Services & programs, Events, Tasks, Roles & access | Dashboard, Staff & families, Programs & notices, Events, Tasks, Roles & access | Overview, Members & volunteers, Initiatives, Events, Tasks, Roles & access |
| Name the roles | `roleLabels` (labels only, role ids never change) | Institution administrator / Program staff / Partner (view only) | Principal or administrator / Teacher or staff / Parent or guardian (view only) | Organization lead / Coordinator / Volunteer or member (view only) |
| Add workspace records | `SEED_WORKSPACES`, members, tasks, programs in `src/services/mock/index.ts` | Sample Riverside Public Library (verified) | Sample Riverside Elementary School (verified); Sample Riverside Language Academy (restricted) | Sample Riverside Neighbours Association (verified); Sample Friends of the Trail (onboarding) |
| Render it | route page renders `WorkspaceClient` | `/institution` | `/institution` (same route, `?ws=` picks the tenant) | `/organization` |
| Safeguard | `safeguards` in the config | Public information only: no case files or client records | No student records or student names | Demo volunteer names only; no contact details or donations |

No shell code was copied. `WorkspaceShell` and `WorkspaceClient` read the tab list, wording and role names from the configuration of the workspace's kind.

Why schools share `/institution`: the Project Plan requires 33 routes and none is named for schools, so a school is an institution type. Adding a 34th route would have changed the required inventory.

## 2. The permission rule (one function)

`decide(action, actor, workspaceStatus)` in `src/lib/permissions.ts`. Actions: view, work, publish, manage.

| Situation | View | Work | Publish | Manage |
| --- | --- | --- | --- | --- |
| Owner, verified | yes | yes | yes | yes |
| Staff, verified | yes | yes | yes | no |
| Member, verified | yes | no | no | no |
| Any role, onboarding | per role | per role | no (not verified) | per role |
| Any role, restricted | yes | no | no | no |
| Invited, not yet accepted (any role, any state) | no | no | no | no |

Order of the checks: invitation not accepted, then view, then restricted (read-only), then role, then verification for publishing.

## 3. Where it is applied

- **In the page:** every control that needs work, publish or manage is disabled when the person selected in **View as** is not allowed, and a line of text says why (the disabled button alone says nothing). An invited person sees a "No access yet" state instead of the content, with a pointer to the Roles & access tab.
- **In the port:** every mutating `WorkspacePort` method takes an optional actor and rejects with `Not allowed: <reason>`. A restricted workspace rejects every change with or without an actor. Calls with no actor behave exactly as in M05, so the M05 tests still describe the same behaviour.
- **On the Roles & access tab:** a table of what each role can do in this workspace, a table of how the three access states change that for the selected person, and the reason for each of the four actions.

## 4. Demonstration script (what a reviewer can do in a browser)

1. `/institution`: dashboard tiles and the "Awaiting publication" list. Switch **View as** to the teacher or the partner and watch Publish and Create draft become unavailable, with the reason shown.
2. `/institution?ws=ws-school-academy` (restricted): every control is disabled for every person, including the director. Roles & access shows the restricted row.
3. `/organization?ws=ws-org-trail` (onboarding): the owner can create a draft and advance tasks, but Publish is unavailable because the organization is not verified.
4. Any tenant: **View as** the person marked "(invited, not active)". The workspace shows "No access yet". Switch to the owner, open Members, press "Accept invitation as this person (demo)", then switch back: the person is now active.
5. `/organization`: as the owner, invite someone (they appear as invited), change a role, and try to demote the only active owner: the port refuses.

## 5. Known limitations (do not hide these at review)

- There is no authentication. **View as** is a demonstration of the rule, not security. A production workspace service must check a real signed-in identity, so the production half of M05-D3 stays open.
- All data is synthetic and in memory per session; invitations, role changes and drafts reset on reload.
- The new tenants have no pins on the shared map. Their programs link only to existing map objects (market, garden, walk, trail).
- Messages, documents and analytics are still not built.
- Role labels are display text on three fixed roles. A tenant type that needs a genuinely different role set (for example a public office in M07) would need a schema change, not just a label.
