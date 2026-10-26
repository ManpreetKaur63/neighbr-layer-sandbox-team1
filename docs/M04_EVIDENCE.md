# M04 evidence: map based social and civic activity

Milestone M04 (Week 4, Oct 12–18). Master Table: "common map and map-linked feed;
implement Civic Pulse, posts, reactions, comments, follows, alerts, polls, issues,
requests, projects, events, groups, marketplace, messaging, notifications and saved
activity. Return approved synthetic outcomes to their map locations and cover loading,
empty, error, restricted and success states."

Run from a clean copy (no `node_modules`, no build output) on Node 24, 18 October 2026.

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm install` | postinstall copies the MapLibre worker |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (strict, includes tests) | pass |
| Unit and component tests | `npm test` | 9 files, 61 tests passed |
| Production build | `npm run build` | compiled; all required routes prerendered |

## What was built (M04 increment)

- **Social layer**: new `SocialPort` in `src/services/ports` (like/unlike, comments,
  save/unsave, follow/unfollow, notifications, poll voting, issue reporting, poll
  creation). UI talks only to the port; the mock keeps state in memory per session,
  so factory instances are isolated in tests.
- **Schemas**: `SocialComment`, `NotificationItem` (zod); poll voting detail
  (`poll.options[].votes`, `closed`) on `CivicObject`; new `alert` civic kind.
- **Fixtures**: 3 polls gained options/votes; 2 Windsor alerts added (29 objects total).
- **Pages**: `/pulse` (map-linked feed of posts/issues/polls with like, comment, save,
  and "View on map" deep links), `/polls` (voting with counts and percentages),
  `/polls/create` (authoring), `/issues/report` (filing), `/alerts`, `/notifications`
  (mark-all-read). Every page covers loading/empty/error/success via `StateBoundary`.
- **Cross-map journeys**: every object deep-links to `/map?sel=<id>`; `tests/unit/map-link.test.ts`
  pins the contract (feed builds the URL, the map restores the selection, reported
  issues and created polls resolve immediately).
- **Error-path proof**: unknown ids, empty comments, overlong comments, votes on
  non-polls/unknown options/closed polls, empty poll questions and single-option
  polls all reject with messages; covered in `tests/unit/social-port.test.ts`.

## Object and state coverage matrix

| Object / surface | States covered | Notes |
| --- | --- | --- |
| `/pulse` feed | loading, empty, error, success | retry on error |
| `/polls` | loading, empty, error, success | per-option vote; closed polls reject |
| `/polls/create` | success, error | validation: question + 2 options |
| `/issues/report` | success, error | validation: title required |
| `/alerts` | loading, empty, error, success | retry on error |
| `/notifications` | loading, empty, error, success | mark-all-read |
| `/map` pins ↔ feed cards | success | `sel` deep link round-trips |
| Admin routes | restricted | unchanged (M08) |

## Defect and change records

| ID | Description | Status |
| --- | --- | --- |
| M04-D1 | Map unit tests hardcoded the Windsor object count (20); 2 alert fixtures took it to 22 | Fixed: expectations updated to 22 in `map-shell.test.tsx` |
| M04-D2 | Mock services mutated shared fixtures; reported issues/votes could leak between factory instances | Fixed: per-factory working copy in `createMockServices` |
| M04-D3 | Groups, events, messages, marketplace remain stubs | Open: deferred; route inventory says so honestly |

## Gate 2 evidence (M03–M04)

- M03: shared map with boundaries, pins, search, filters, detail panels, list alternative (`/map`, built).
- M04: social and civic activity layer above (this document).
- Route inventory (`src/lib/routes.ts`) is the single source of truth; `/status` renders it.
- AI assistance: the M04 increment was drafted by an AI assistant and reviewed by the
  team before deposit (see review note below).

## Still team-only before the deposit

- [ ] **Teammate review** of this increment (portal rule: no unreviewed generated code). Reviewer: [TEAM]
- [ ] **Recorded demonstration** of the pulse → map journeys. Link: [TEAM]
- [ ] **PR and CI links** in the team repo. Links: [TEAM]
- [ ] **Tag `m04community`** in the team repo. Commit: [TEAM]
- [ ] **Screenshots** of the new pages. Files: [TEAM]
- [ ] **Clean-clone check** on a team machine. Machine/result: [TEAM]
