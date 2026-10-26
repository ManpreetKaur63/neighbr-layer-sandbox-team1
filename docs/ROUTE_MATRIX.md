# Route coverage matrix

Generated from `src/lib/routes.ts` for milestones M01–M05 merged. The same data drives the `/status` page.

| Route | Family | Milestone | Status | Data source | States covered | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Core public | M02 | Partly built | None yet | success | e2e route responds (sampled); build prerenders it |
| `/map` | Core public | M03 | Built | Mock services (`/mock`) | loading, empty, error, restricted, success | e2e `map.spec.ts` + unit `map-shell.test.tsx` |
| `/pulse` | Core public | M04 | Built | Mock services (`/mock`): posts, issues, polls + SocialPort | loading, empty, error, success | unit `social-port.test.ts`, `map-link.test.ts` |
| `/alerts` | Core public | M04 | Built | Mock services (`/mock`): alert kind | loading, empty, error, success | unit `mock-services.test.ts` fixtures |
| `/polls` | Core public | M04 | Built | Mock services (`/mock`): polls + SocialPort.vote | loading, empty, error, success | unit `social-port.test.ts` |
| `/polls/create` | Core public | M04 | Built | SocialPort.createPoll (in-memory) | success, error | unit `social-port.test.ts` |
| `/issues/report` | Core public | M04 | Built | SocialPort.reportIssue (in-memory) | success, error | unit `social-port.test.ts` |
| `/beacon` | Core public | M03 | Partly built | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/signin` | Identity and profile | M02 | Built | Demo shell only — no real auth | pending, denied, expired, recovery, success, error | unit `identity.test.ts`; build prerenders it |
| `/signup` | Identity and profile | M02 | Built | Demo shell only — no account created | success, error | unit `identity.test.ts`; build prerenders it |
| `/profile` | Identity and profile | M02 | Built | Mock session (Demo resident, Windsor) | loading, error, success | build prerenders it |
| `/settings` | Identity and profile | M02 | Built | Demo shell only — nothing stored | success, error | unit `identity.test.ts`; build prerenders it |
| `/notifications` | Identity and profile | M04 | Built | SocialPort.notifications (in-memory) | loading, empty, error, success | unit `social-port.test.ts` |
| `/groups` | Community | M04 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/events` | Community | M05 | Built | Mock services (`/mock`): event kind | loading, empty, error, success | unit `workspace-port.test.ts` cross-journey; build prerenders it |
| `/messages` | Community | M04 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/marketplace` | Community | M04 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/businesses` | Community | M05 | Built | Mock services (`/mock`): business kind + WorkspacePort claim state | loading, empty, error, success | unit `workspace-port.test.ts` |
| `/institution` | Institutional | M06 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/organization` | Institutional | M06 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
| `/representative` | Institutional | M07 | Stub | None yet | empty | e2e route responds (sampled); build prerenders it |
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

33 routes: 16 built, 2 partly built, 15 stubs. Stubs show the shared empty or restricted state and link back to the map.
