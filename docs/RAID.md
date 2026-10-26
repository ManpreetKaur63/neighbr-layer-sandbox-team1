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
