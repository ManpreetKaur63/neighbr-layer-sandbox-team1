# M03 evidence: Layer 1 map environment

Run from a clean copy (no `node_modules`, no build output) on Node 22.22.0, 15 October 2026.

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | 464 packages, postinstall copies the MapLibre worker |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (strict, includes tests) | pass |
| Unit and component tests | `npm test` | 7 files, 40 tests passed |
| Production build | `npm run build` | compiled; 33 required routes prerendered |
| End-to-end | `npm run test:e2e` (Chromium) | 12 passed, including an axe scan (WCAG 2 A/AA, serious and critical) of `/map` |

## Screenshots

| File | Shows |
| --- | --- |
| `docs/evidence/m03/map-desktop.png` | 1440 px: top bar, results panel, outlines, clusters, pins |
| `docs/evidence/m03/map-tablet.png` | 820 px: two-row top bar |
| `docs/evidence/m03/map-mobile.png` | 390 px: bottom sheet over the map |
| `docs/evidence/m03/detail-desktop.png` | Detail panel with an outcome on a resolved issue |

The screenshots were taken in a sandbox with no route to OpenStreetMap, so the basemap tiles are blank. Outlines, clusters and pins are drawn by the app and are unaffected.

## Not covered by these checks

- Manual keyboard and screen-reader review (scheduled in M09).
- Real-device testing on phones and tablets (the three widths above are emulated).
- Basemap tiles on a networked machine (needs a quick visual check on first run).
- Performance with large datasets (27 synthetic records only).
