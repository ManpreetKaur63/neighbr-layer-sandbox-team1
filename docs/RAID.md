# RAID register (M03)

| ID | Type | Item | Owner | Response | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | Risk | OpenStreetMap public tiles have a usage policy and no guarantee | Architecture lead | Dev-only, low volume, attribution shown, `NEXT_PUBLIC_BASEMAP=none` switch. Ask Neighbr which tile source production will use. | Open |
| R2 | Risk | Corridor outline coordinates are approximate and could be mistaken for the real boundary | Experience lead | Marked *illustrative* in data, list and detail panel. Replace with vetted geometry when Neighbr supplies it. | Open |
| R3 | Risk | The bundled MapLibre worker failed under Turbopack | Architecture lead | Static worker file plus `setWorkerUrl` (ADR-003). Re-test when upgrading MapLibre or Next. | Mitigated |
| R4 | Risk | Library versions are very recent (Next 16, React 19, MapLibre 6, Zod 4) | Quality lead | Exact versions pinned. Compare against the frozen compatibility profile when received. | Open |
| R5 | Risk | jsdom 30 declares Node 22.22.2+; some machines run 22.22.0 | Quality lead | Tests passed on 22.22.0 with an engine warning. Use the version in `.nvmrc` or newer. | Accepted |
| A1 | Assumption | Windsor, Detroit and Toronto demo data is enough to show city switching | Experience lead | Other cities show the empty state on purpose. | Open |
| A2 | Assumption | Visitor context and resident-only polls match Neighbr's intent (from the 5 Oct demonstration) | Team | Confirm in the next office hours. | Open |
| I1 | Issue | Cluster circles show no counts | Experience lead | ADR-010. List shows counts. | Accepted |
| I2 | Issue | Layer 2 workspaces, onboarding, posts and polls are not built | Team | Scheduled in M02, M04 to M08. Stubs make routes real now. | Planned |
| I3 | Issue | Manual keyboard and screen-reader pass has not been done | Quality lead | axe scan passes for `/map`. Manual review scheduled in M09. | Open |
| D1 | Dependency | Frozen compatibility profile and clarification log are in the control repository | Delivery lead | Check them against ADR-001 before the next gate. | Open |

## M06 additions

| ID | Type | Item | Owner | Response | Status |
| --- | --- | --- | --- | --- | --- |
| R6 | Risk | The role chosen at signup could be mistaken for real access control (M07: the "view as" switch is gone; the role choice is the demo now) | Team | Labelled a demo choice at signup and in Settings; no authentication exists. A production workspace service must check a real signed-in identity (M05-D3 stays open for production). | Open |
| R7 | Risk | School and community-organization workspaces could be read as holding real people's data | Team | Demo names only; per-kind safeguard notices (no student records, no contact details or donations). Do not add real or student data to fixtures. | Mitigated |
| I4 | Issue | New tenants have no pins on the shared map; their programs link only to existing map objects | Team | Fixtures left unchanged so the Windsor result counts pinned by the map tests do not move. Add tenant pins as a follow-up with the tests updated to derive counts from the fixtures. | Open |
| I5 | Issue | Fixture `w-ward` points at workspace `ws-ward-sample`, which does not exist, so its "Open in workspace" link shows "Workspace not found" | Team | **Fixed in M07:** the fixture now points at `ws-gov-public-works`; `workspaceHrefForObject` routes `ws-gov-…` ids to `/government`. | Closed |
| R8 | Risk | Request state could be read as lost data on reload | Team | Mitigated 2 Nov: request store and reported issues are saved in session storage (guarded). Other state (likes, saved items, workspace drafts and invitations) still resets on reload. Different tabs do not share state. | Partly mitigated |
| I6 | Issue | Each page built its own mock services, so a report filed on one page was invisible on the next | Team | Fixed for requests and reported issues with a store the services share (`src/services/mock/requests.ts`). Other state (likes, saved items, offers drafted in a workspace) is still per page. | Partly fixed |
| I7 | Issue | The request journey had not been clicked through in a real browser | Team | Done 2 Nov in headless Chromium against the production build (`docs/evidence/m06/`). The team's own browser test and the Playwright suite are still open. | Partly closed |
| I8 | Issue | BIA directory listed every business in the city; reports were placed outside the corridor and routed by city | Team | Fixed 2 Nov: directory, events and counts limited to the boundary; routing by boundary. The corridor polygon is an illustrative placeholder and must be replaced with vetted geometry. | Fixed (placeholder geometry) |
