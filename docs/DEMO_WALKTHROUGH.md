# Demo walkthrough: community issue → BIA action → visible outcome

All data is invented. The demo session is shared by every screen in one browser tab and kept in `sessionStorage`
(`src/services/session.ts`), so each step below really changes what the next screen shows. **Reset demo data**
(on the BIA dashboard) starts again from the fixtures.

| # | Screen | Do this | What carries over |
| --- | --- | --- | --- |
| 1 | `/businesses` | Choose **Only inside Olde Riverside corridor (illustrative)** | 3 businesses (Bakery, Hardware, Café). Books and Pizza are downtown and are left out. |
| 2 | `/map` | Click the area **Olde Riverside corridor** | The detail panel counts the businesses inside the outline and links to the BIA directory. |
| 3 | `/issues/report` | Title "Broken bench by the bakery", keep **Olde Riverside corridor**, **File report** | A new open issue exists on the shared map, inside the corridor. |
| 4 | `/bia?ws=ws-bia-sample&tab=signals` | The issue is listed under **Community signals**. **Take on as a task** | Issue becomes *Acknowledged* and shows "Being handled by a BIA". The reporter gets a notification. |
| 5 | same | **Start task**, then **Mark done** | Issue becomes *In progress*, then *Resolved* with a published **Outcome**. Each step notifies the reporter. |
| 6 | `/notifications` | Read the three updates | Links go to the issue on the map. |
| 7 | `/map?sel=<issue>` | Open the issue | Status *Resolved*, **Outcome** card, link back to the BIA follow-up. |
| 8 | `/pulse` | Find the issue | Shows the new status. |

Try the guard rails: report from **Downtown Windsor** instead. It never appears under the BIA's Community signals,
and the service rejects any attempt to take it on (outside the boundary).

## Where the rules live
- Boundary filter: `ObjectQuery.boundaryId` → `filterObjects` → `pointInRing` (`src/lib/geo.ts`).
- Workspace ↔ boundary: `Workspace.boundaryId` (BIA only).
- Signal loop: `WorkspacePort.raiseTaskFromIssue`, and `syncSourceObject` in `src/services/mock/index.ts`.
- Shared session: `useServices()` (`src/services/use-services.ts`). Screens must not call `createMockServices()` directly.

## Honest limits
- The Olde Riverside outline is still an illustrative placeholder, so "inside the boundary" is only as good as that geometry.
- Persistence is per browser tab (`sessionStorage`), not a backend. A new tab starts from the fixtures.
- The browser (Playwright) tests added for the phone layout and the journey were written but not run in the authoring environment; run `npm run test:e2e`.
