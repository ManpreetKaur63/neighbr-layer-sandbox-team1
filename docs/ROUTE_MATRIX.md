# Route coverage matrix

Generated from `src/lib/routes.ts` for milestones M01–M07. The same data drives the `/status` page.

| Route | Family | Milestone | Status | Data source | States covered | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Core public | M02 | Partly built | None yet | success | e2e route responds (sampled); build prerenders it |
| `/map` | Core public | M03 | Built | Mock services (`/mock`) | loading, empty, error, restricted, success | e2e `map.spec.ts` + unit `map-shell.test.tsx` |
| `/pulse` | Core public | M04 | Built | Mock services (`/mock`): posts, issues, polls + SocialPort | loading, empty, error, success | unit `social-port.test.ts`, `map-link.test.ts` |
| `/alerts` | Core public | M04 | Built | Mock services (`/mock`): alert kind | loading, empty, error, success | unit `mock-services.test.ts` fixtures |
| `/polls` | Core public | M04 | Built | Mock services (`/mock`): polls + SocialPort.vote | loading, empty, error, success | unit `social-port.test.ts` |
| `/polls/create` | Core public | M04 | Built | SocialPort.createPoll (in-memory) | success, error | unit `social-port.test.ts` |
| `/issues/report` | Core public | M04 | Built | SocialPort.reportIssue (in-memory) + RequestPort (handler choice: BIA or department, M07) | success, error | unit `social-port.test.ts`, `m07-government-roles.test.ts` |
| `/beacon` | Core public | M03 | Partly built | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/signin` | Identity and profile | M02 | Built | Looks the email up in the local database (M07 addendum); pending, denied, expired, recovery previews | pending, denied, expired, recovery, not-found, success, error | unit `identity.test.ts`, `onboarding-signin-ui.test.tsx`; build prerenders it |
| `/signup` | Identity and profile | M02 | Built | Saves the demo account in the local database (M07 addendum); role step (M07) kept in the browser session | success, error | unit `identity.test.ts`, `onboarding-signup-ui.test.tsx`; build prerenders it |
| `/profile` | Identity and profile | M02 | Built | Shows the saved account when one exists, else the fixed demo profile; privacy toggles saved in the local database (M07 addendum) | loading, error, success | build prerenders it |
| `/settings` | Identity and profile | M02 | Built | Account, privacy, accessibility and your onboarding role (M07); all saved in the local database, with a clear-demo-data section (M07 addendum) | success, error | unit `identity.test.ts`; build prerenders it |
| `/notifications` | Identity and profile | M04 | Built | SocialPort.notifications (in-memory) | loading, empty, error, success | unit `social-port.test.ts` |
| `/groups` | Community | M04 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/events` | Community | M05 | Built | Mock services (`/mock`): event kind | loading, empty, error, success | unit `workspace-port.test.ts` cross-journey; build prerenders it |
| `/messages` | Community | M04 | Partly built | The person's requests, replies and follow-up (request conversations only; no direct or group chats) | empty (no requests), loading, error | `request-journey-ui.test.tsx`; build prerenders it |
| `/marketplace` | Community | M04 | Built | Published offers from business workspaces; Request address | empty, loading, error | `request-journey-ui.test.tsx`; build prerenders it |
| `/businesses` | Community | M05 | Built | Mock services (`/mock`): business kind + WorkspacePort claim state | loading, empty, error, success | unit `workspace-port.test.ts` |
| `/institution` | Institutional | M06 | Built | WorkspacePort (members, tasks, programs) for the institution and two school tenants | loading, error (unknown `?ws=`), success; restricted, onboarding and no-access (invited) states per tenant | unit `workspace-m06.test.ts`, `permissions.test.ts` |
| `/organization` | Institutional | M06 | Built | WorkspacePort (members, tasks, programs) for two community organization tenants | loading, error (unknown `?ws=`), success; onboarding and no-access (invited) states | unit `workspace-m06.test.ts`, `permissions.test.ts` |
| `/government` | Institutional | M07 | Built | WorkspacePort (members, tasks, programs, requests) for two government department tenants | loading, error (unknown `?ws=`), success; onboarding and no-access (invited) states | unit `m07-government-roles.test.ts`, `permissions.test.ts` |
| `/representative` | Institutional | M07 | Partly built | Profile page (sample ward councillor); representatives are people, not workspaces | success | build prerenders it |
| `/business` | Institutional | M05 | Built | WorkspacePort (members, tasks, offers, claim) + mock objects | loading, empty, error, success | unit `workspace-port.test.ts` |
| `/bia` | Institutional | M05 | Built | WorkspacePort (members, tasks, offers, claim) + mock objects | loading, empty, error, success | unit `workspace-port.test.ts` |
| `/admin` | Administration | M08 | Stub | None yet | restricted | e2e route responds (sampled); build prerenders it |
| `/admin/users` | Administration | M08 | Stub | None yet | restricted | e2e route responds (sampled); build prerenders it |
| `/admin/content` | Administration | M08 | Stub | None yet | restricted | e2e route responds (sampled); build prerenders it |
| `/admin/audit` | Administration | M08 | Stub | None yet | restricted | e2e route responds (sampled); build prerenders it |
| `/admin/system` | Administration | M08 | Stub | None yet | restricted | e2e route responds (sampled); build prerenders it |
| `/help` | Delivery support | M09 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/privacy` | Delivery support | M09 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/terms` | Delivery support | M09 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/accessibility` | Delivery support | M09 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/status` | Delivery support | M03 | Built | `routes.ts` | success | e2e route responds (sampled); build prerenders it |

34 routes: 20 built, 4 partly built, 10 stubs. Stubs show the shared empty or restricted state and link back to the map.
