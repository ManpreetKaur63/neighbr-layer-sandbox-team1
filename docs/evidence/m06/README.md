# M06 evidence: screenshots and video

Captured on 1 to 2 November 2026 (build machine clock, UTC) from the **production build** (`npm run build`, `next start`) in headless Chromium, by `record-journey.py` (Playwright). All data is invented. Screens 01 to 23 are 1280x800; 24 to 26 are phone sizes. Captions in the images and the video are added by the script.

**Video:** `m06-journey-demo.mp4` (72 seconds): BIA boundary check, report, BIA queue, assign, ask, reply, resolve, outcome on Messages, Notifications, Pulse and Map, follow-up, a report outside the corridor, and the Marketplace request answered in the Business workspace. Between screens the script loads a full new page, so it also shows the changes surviving navigation.

| File | What it shows |
| --- | --- |
| 01-bia-overview-boundary-count | BIA overview: "4 of the 8 listings and places in Windsor are inside" the corridor |
| 02-bia-listings-inside-boundary | BIA Listings tab: only the 4 inside the corridor |
| 03, 04 | Report form with "Where is it?"; report filed and sent to the BIA queue |
| 05 | Resident in Messages: Submitted, handled by the BIA |
| 06, 07 | BIA Requests tab: new report; assigned, In review |
| 08, 09, 10 | Coordinator asks a question; resident sees and answers it; back In review |
| 11 | Coordinator resolves: "Bench repaired" |
| 12, 13, 14, 15 | Visible outcome: Messages, Notifications, Pulse, Map all show Resolved |
| 16 | Resident follows up; request reopens |
| 17 | Report outside the corridor: stays on the map, not sent to a BIA |
| 18, 19, 20, 21 | Marketplace offer; Business workspace Requests, Overview, Roles & access |
| 22, 23 | BIA Roles & access and Overview |
| 24, 25, 26 | Phone: map with sheet open (390x844, 360x640), sheet hidden, BIA workspace |

Not covered by this evidence: the existing Playwright suite and the axe scan were not run; no teammate has looked at these screens.
