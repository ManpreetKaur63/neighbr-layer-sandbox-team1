# M06 request journey: one request, from the person, through the organization, and back

Answers the M06 feedback brief. Built on 1 November 2026 on top of the M06 workspaces. Honest status first: this increment was written with AI assistance and has **not been teammate-reviewed**; the portal forbids depositing unreviewed generated code.

## 1. The example we chose, and why it fits our scope

**A resident reports a problem on the map. The BIA coordinator sees it in the BIA work queue, assigns it, and sends an update. The resident checks the status, reads the response, and follows up if the problem remains.**

It fits because the BIA workspace (M05) and the roles and permission rule (M06) already exist, and the city has no department workspace yet (the Representative workspace is M07). A second request type uses the same screens: **a person asks a business for an address from a Marketplace offer, and the business owner answers in its workspace** (the Marketplace and Messages pages, pending since M04, are built for this).

> **Update, 2 November 2026.** Step 1 now asks "Where is it?" and the report goes to the BIA whose boundary contains the place; outside every BIA it stays on the map and says so. The shared state is also kept in the browser session, so it survives a full page load (a new tab starts clean). The whole walkthrough below was clicked through in a real browser: see `docs/evidence/m06/` (video and screenshots) and the check table in `docs/M06_EVIDENCE.md`. Test totals are now 134 in 16 files.
>
> **Update, 7 November 2026 (M07).** Roles moved out of the workspaces and into onboarding: there is no "View as" switch any more. The steps below that said "View as the coordinator" now read "signed up as BIA coordinator" — the role is chosen at signup and can be changed in Settings. The walkthrough is otherwise unchanged. A city department can now be the handler instead of the BIA (see `docs/M07_EVIDENCE.md`).

## 2. Walkthrough: one complete journey, by person

| # | Who | Screen | Step | Result they see |
| --- | --- | --- | --- | --- |
| 1 | Resident | `/issues/report` | Files "Broken bench on Riverside" | The issue is on the map as Open, and "sent to the Olde Riverside BIA work queue" with a link to Messages |
| 2 | Resident | `/messages?id=…` | Opens the link | Status **Submitted**, "Handled by Sample Olde Riverside BIA", who can view or change it, and the record: "Request submitted" |
| 3 | BIA coordinator (staff) — signed up as BIA coordinator | `/bia` → **Requests** | Opens the request in the work queue | Same record and messages; controls for the coordinator |
| 4 | BIA coordinator | `/bia` → Requests | Takes it: assigns it to themself (Demo corridor coordinator) | Status **In review**, "Assigned to Demo corridor coordinator" |
| 5 | Coordinator (staff) | `/bia` → Requests | Asks for more information: "Which side of the street?" | Status **Needs more information**; the question is also a message |
| 6 | Resident | `/messages` or `/notifications` | Reads the question and replies | Status back to **In review**; the record shows "Information provided" |
| 7 | Coordinator | `/bia` → Requests | Resolves with "Bench repaired" | Status **Resolved** |
| 8 | Resident | `/messages`, `/pulse`, `/map` | Reads the outcome; the issue on the map now says Resolved | "The team marked this resolved", and the message "Resolved: Bench repaired" |
| 9 | Resident | `/messages` | Follows up: "It is loose again" | Status **In review** again; the record shows "Reopened by the person (follow-up)" |

Marketplace variant: `/marketplace` → **Request address** on "Weekend bread bundle" → the bakery owner sees it in `/business` → **Requests** → resolves with a demo note → the person reads it in `/messages`.

Throughout, every request screen shows **who can view or change it** (the person, the handling organization's owner and staff, view-only members, everyone else), **its current status**, and a **record of what happened** (who did what, when).

## 3. What happens when it does not go to plan

| Case | What happens | Where it is enforced |
| --- | --- | --- |
| **Declined** | The coordinator must give a reason. Status **Declined**; the person sees the reason as a message and in the record, and can **Follow up** to reopen it | `RequestPort.handle` (decline needs a note), `RequestDetail` |
| **More information needed** | The coordinator must write the question. Status **Needs more information**; the person's reply puts it back **In review** | `RequestPort.handle` and `reply` |
| **Someone without permission tries to act** | In the screen every control is disabled with the reason ("The member role cannot work on tasks and drafts"). If a call still reaches the service it rejects with "Not allowed: …". An invited person who has not accepted has no access. A restricted workspace is read-only for everyone | `decide` in `src/lib/permissions.ts`, used by both the screen and the service |
| Resolve before review, assign a view-only member, empty note | Rejected with a plain message | `RequestPort.handle` |
| Reply to a closed request | Rejected: use Follow up | `RequestPort.reply` |

## 4. What works, what is simulated, what remains

**Works (in the demonstration build):** the full journey above across Report an issue, Messages, Notifications, the BIA and Business workspace Requests tabs, the map and Pulse (the issue's status is written back); Marketplace listing of published offers and Request address; assign, start review, ask for information, decline, resolve, message, reply, follow-up; status, record and access lines on every request; the shared permission rule on every control and in the service; 21 new automated tests.

**Simulated:**
- All data is invented and in memory. The state is shared between pages and kept for the browser session (it survives a full page load; closing the tab resets it).
- There is no sign-in. Your role is chosen when you sign up (M07) and can be changed in Settings; it chooses which workspace member acts, and is not security. The person is always "Demo resident".
- No real delivery: messages and notifications are rows in memory.
- Address requests never contain a real address; the owner types a demo note.

**Remains to be built:**
- Real authentication and server-side permission checks (M05-D3 stays open for production).
- Persistence beyond one session, and real notifications (email or push).
- Direct and group chats (Messages carries request conversations only), attachments, and a way for several people to see one request.
- A city department or Representative workspace as a handler (M07), tenant pins on the map (I4), Groups, Admin and the audit viewer (M08), Help and policy pages (M09).
- A queue filter and sort, and a search in Messages.

## 5. Record of what we tested, learned and changed

**Checks run on 1 November 2026 on the modified codebase (Node 22.22.2):**

| Check | Result |
| --- | --- |
| Baseline, unmodified M06 code: lint, typecheck, `npm test` | 0 errors, passes, **106 of 106** |
| After this change: `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | passes |
| `npm test` | **127 of 127** in 15 files (106 existing + 16 in `requests-port.test.ts` + 5 in `request-journey-ui.test.tsx`) |
| `npm run build` | passes; 35 routes prerendered |
| Production server: `/messages`, `/marketplace`, `/issues/report`, `/bia`, `/business`, `/status`, `/map` | each answered HTTP 200 |
| Fresh unzip of the delivery zip, `npm ci`, then `npm run check` | passes (lint, typecheck, 127 of 127 tests, build with 35 routes). This is not the team's clean-clone check on a team machine, which stays open |
| Playwright end-to-end and the axe scan | **not run** (no Chromium in this environment) |
| Pages looked at in a real browser | Done on 2 November 2026 for the journey, BIA and Business workspaces and the phone map (`docs/evidence/m06/`); the team's own browser test is still open |

**What the tests cover:** routing to the BIA; the work queue; assign rules; resolve needing review and a note; ask-information and reply; decline and follow-up; messaging; view-only and invited people rejected with the shared reason; address requests only for a business the workspace manages; notifications for the person; the same journey clicked through the Marketplace, business workspace and Messages screens; the disabled controls for a view-only member.

**What we learned:**
1. Each page in the shell builds its own mock services, so a report filed on one page was invisible on the next. A journey across screens needs shared state.
2. The reported issue never reached any organization: the BIA signal loop was a pre-written trace for one seeded issue.
3. "Messages" and "Marketplace" were only placeholders, so there was no way for the organization to answer the person.

**What we changed:**
1. Added a request store that the mock services share (`src/services/mock/requests.ts`). Tests pass a fresh store so nothing leaks.
2. Added the `RequestPort`, the request schema and the shared rules (`src/lib/requests.ts`), with every change written to a history.
3. Wrote the screens: `RequestDetail`, `RequestQueue` (a Requests tab on the BIA and Business workspaces), Messages and Marketplace.
4. The report form now also sends the issue to the BIA queue; the issue on the map and Pulse follows the request status; request updates appear in Notifications.
5. Routes: Marketplace is now **built**, Messages is **partly built** (requests only), so the inventory is 33 routes: 19 built, 3 partly built, 11 stubs (was 18 / 2 / 13).

Test record by person, to complete in a browser before the deposit:

| Test | Who | Result | What we learned | What we changed |
| --- | --- | --- | --- | --- |
| Steps 1 to 9 of the walkthrough | Resident, chair, coordinator | [TEAM: record] | [TEAM] | [TEAM] |
| Decline with a reason, then follow up | Coordinator, resident | [TEAM: record] | [TEAM] | [TEAM] |
| View as the invited or view-only member | Member | [TEAM: record] | [TEAM] | [TEAM] |
| Marketplace request, answered by the bakery owner | Resident, bakery owner | [TEAM: record] | [TEAM] | [TEAM] |

## 6. Gaps and how we close them

| Gap | How we close it | Owner | Target (proposed, confirm) |
| --- | --- | --- | --- |
| Teammate review of M06 and this increment, PR and CI links, tag, screenshots, clean-clone check | Review and deposit steps on a team machine (`npm ci`, `npm run check`, `npm run test:e2e`) | [TEAM] | Week 7: Nov 2 to 8 |
| Journey not yet clicked in a real browser | Run the walkthrough, record screenshots and the table in section 5 | [TEAM] | Week 7: Nov 2 to 8 |
| Queue filter, sort, and message search | Small additions to `RequestQueue` and Messages | [TEAM] | Week 8: Nov 9 to 15 |
| Persistence across sessions and tabs | Done for one tab's session (2 Nov). A real service is needed beyond that | [TEAM] | Week 8: Nov 9 to 15 |
| Representative workspace as a handler, fix `w-ward` (I5) | M07 | [TEAM] | Week 8 to 9 |
| Admin: request audit viewer | M08 | [TEAM] | Week 9: Nov 16 to 22 |
| Help, privacy, accessibility pages and the manual accessibility pass | M09 | [TEAM] | Week 9: Nov 16 to 22 |
| Final deliverable | | [TEAM] | [final date, confirm] |

## 7. Where to find the evidence in the code

| What | File |
| --- | --- |
| Request contract and statuses | `src/lib/schemas.ts` (`civicRequestSchema`) |
| Shared rules and the "who can view or change" lines | `src/lib/requests.ts` |
| Port | `src/services/ports/index.ts` (`RequestPort`) |
| Mock service and shared store | `src/services/mock/requests.ts`, wired in `src/services/mock/index.ts` |
| Person's screen | `src/app/messages/MessagesClient.tsx`, `src/components/RequestDetail.tsx` |
| Organization's screen | `src/components/RequestQueue.tsx`, the Requests tab in `src/components/WorkspaceClient.tsx` |
| Marketplace | `src/app/marketplace/MarketplaceClient.tsx` |
| Intake | `src/app/issues/report/ReportIssueClient.tsx` |
| Tests | `tests/unit/requests-port.test.ts`, `tests/unit/request-journey-ui.test.tsx` |
