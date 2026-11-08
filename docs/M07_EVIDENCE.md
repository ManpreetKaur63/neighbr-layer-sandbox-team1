# M07 evidence: public office and government department workspaces

Milestone intent: show public-facing communication and governed response views. Built on the M01–M06 codebase. All data is invented.

## What was run

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors |
| `npm run typecheck` | pass |
| `npm test` | **191 of 191 pass in 19 files** (134 existing, unchanged, plus 57 new) |
| `npm run build` | pass, 33 routes |
| Screens in a real browser | 18 screenshots, headless Chromium from an npm package, production build, 360, 390 and 1280 px wide; horizontal overflow measured **0 px** on all 18 |
| Playwright suite and axe scan | **not run** (could not install Chromium) |
| Physical phone, screen reader, teammate review | **not done** |

## Deliverables

| Deliverable | Where | How to see it |
| --- | --- | --- |
| Public office dashboard shell | `/representative?ws=ws-ward-sample` | Dashboard; **Public view** (`&tab=public`) shows only published items, counts what is withheld, phone/full width switch |
| Government department workspace | `/representative?ws=ws-dept-works` (also Parks, Licensing restricted, Transit onboarding) | Routed cases, responses, tasks, audit, roles |
| Case/task routing and publication states | Cases, Communications and Tasks tabs | Route CASE-1006 to Parks, switch to Parks, accept it. Draft, submit and approve a notice |
| Audit-visible interaction evidence | Audit record tab; "Record of this case" | Route to the restricted Licensing department, or press "Try to approve my own draft": the refusal appears with its reason. CSV download |
| Proper mobile view | all of the above | Menu button, scrolling tabs, list/detail screens, card audit, 44 px targets |

## Enforced in the service, not only hidden in the UI

- Only a verified, same-city department takes a routed case; restricted and onboarding ones refuse, and the refusal is recorded.
- A department sees only cases routed to it; only the office routes; only the routed department accepts, returns or closes.
- Return and close need a note. A case cannot close while a response to it is in review.
- Approval needs the owner role and a person other than the author (four-eyes). Staff cannot approve, return or withdraw.
- Onboarding workspaces draft but cannot publish; restricted ones are read-only; invited people have no access.
- The audit record is append-only with sequence numbers; refused attempts are entries.

## Screenshots (`docs/evidence/m07/`, script `capture-screens.mjs`)

01 office dashboard · 02 on a phone · 03 menu open · 04, 05 public view · 06 cases · 07, 08 list and case on a phone · 09 refused route recorded · 10 communications · 11, 12 audit · 13, 14 department · 15 restricted department · 16, 17 at 360 px · 18 roles and approval rules.

## Honest limits

- No authentication: "View as" is a demonstration. The audit record has no real identity and no tamper protection (RAID R9).
- State lives in the browser session; a new tab starts from the seed.
- Office cases are separate from M06 resident requests (RAID I9).
- The public view shows a case reference on a published response (RAID R10).
- AI-assisted, not teammate-reviewed. Run `npm ci && npm run check` and `npm run test:e2e` on a team machine before depositing.
