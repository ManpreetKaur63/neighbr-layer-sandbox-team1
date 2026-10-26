# Requirements traceability: M03 Layer 1 map environment

Sources: Master Table week 3, Project Plan sections 4.4, 5 and 6, Shell Guide, office-hours demonstration (5 Oct). "Team interpretation" marks choices we made from that demonstration; confirm them with Neighbr.

| ID | Requirement | Route / module | Test | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| M03-01 | Responsive map-first public environment | `/map`, `MapShell`, `map.module.css` | e2e screenshots at 390, 820, 1440 px; no horizontal scroll | `docs/evidence/m03/map-*.png` | Done |
| M03-02 | Search | `TopBar`, `filterObjects` | unit `query.test.ts`; unit + e2e "searches as you type" | e2e `map.spec.ts` | Done |
| M03-03 | Filters | `ResultsPanel`, lens switch | unit `query.test.ts`, `map-shell.test.tsx`; e2e filters | e2e `map.spec.ts` | Done |
| M03-04 | Boundaries | `maplibre-adapter`, `DetailPanel` (boundary) | unit boundary selection; e2e boundary selection | screenshots | Done (illustrative geometry) |
| M03-05 | Pins | `maplibre-adapter` (clustered markers) | unit: markers reach `MapPort`; e2e canvas renders | screenshots | Done (no cluster counts, ADR-010) |
| M03-06 | Cards and detail panels | `ResultsPanel` rows, `DetailPanel` | unit open/close; e2e Escape | `detail-desktop.png` | Done |
| M03-07 | Local GeoJSON / synthetic data | `/mock/*.json`, mock services, Zod schemas | unit `fixtures.test.ts`, `mock-services.test.ts` | unit run | Done |
| M03-08 | Map library isolated behind a replaceable adapter | `src/map/map-port.ts`, `stub-map.ts` | unit `map-shell.test.tsx` runs the whole shell on `StubMapPort` | unit run | Done |
| M03-09 | Beacon placement | reserved slot on the map, `/beacon` stub | e2e route responds | screenshots | Partial: slot only, no interaction (by design: no protected logic) |
| M03-10 | Loading, empty, error, restricted, success states | `StateBoundary` | unit `state-boundary.test.tsx`, `map-shell.test.tsx`; e2e demo states | e2e `map.spec.ts` | Done on `/map`; stubs show empty or restricted |
| M03-11 | Non-map alternative | results list, skip link, map-unavailable fallback | e2e axe; unit list-driven selection | screenshots | Done |
| M03-12 | Accessibility basics: keyboard, visible focus, 16 px text, 44 px targets, contrast | global tokens, components | e2e axe scan (WCAG 2 A/AA, serious+critical) | e2e run | Done for `/map`; manual review in M09 |
| M03-13 | Deep links | `url-state.ts` | unit `url-state.test.ts`, deep-link restore | unit run | Done |
| M03-14 | Visitor context when viewing another city (team interpretation) | `resolveVisit`, `TopBar`, `DetailPanel` | unit `visit.test.ts`; unit + e2e restriction | e2e run | Done |
| M03-15 | All required routes exist | `src/app`, `routes.ts`, `/status` | build prerenders 33 routes; e2e route sample | `docs/ROUTE_MATRIX.md` | Done (stubs) |
| M03-16 | Clean install, lint, typecheck, test, build | CI workflow, `npm run check` | CI | `docs/M03_EVIDENCE.md` | Done |
