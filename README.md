# Neighbr front-end shell (candidate)

A responsive, map-first front-end shell for Neighbr, built for COMP 8967 with **synthetic data and mock services only**. There is no backend, no authentication and no production access.

**Current state: milestones M01–M07 in one codebase.** M07, the public office and government department workspaces, is the latest milestone (not yet tagged: team-only steps are open, see `docs/M07_EVIDENCE.md`). It also moves roles into onboarding and saves the demo account in the browser's local database (IndexedDB). M06, the institution, school and community organization workspaces, built the shell M07 reuses; M02 entry and profiles were built into this merge as a backfill on 25 Oct 2026 (its portal week ended 4 Oct, so that part is LATE — see `docs/M02_EVIDENCE.md`). The M06 request journey (`docs/M06_REQUEST_JOURNEY.md`) also builds Messages and Marketplace: one request followed from the person through the organization and back. Later milestones fill in the remaining stub routes.

## Run it

Requirements: Node 22 and npm.

```bash
npm install          # also copies the MapLibre worker into public/maplibre
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run check` | lint, typecheck, unit tests and production build (the CI gate) |
| `npm test` | unit and component tests (Vitest, jsdom) |
| `npm run test:e2e` | end-to-end tests with Playwright, including an axe accessibility scan; writes screenshots to `docs/evidence/m03` |
| `npm run build && npm start` | production build and server |

For the end-to-end tests, Playwright needs a Chromium. Run `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing binary.

The basemap uses OpenStreetMap raster tiles at low volume (attribution is shown). Set `NEXT_PUBLIC_BASEMAP=none` to run fully offline: outlines and pins still draw on a plain background.

## What to try

- `/map` the shared map: search, kind filters, the Social / Civic pulse / Combined switch, area outlines, pins and clusters, detail panel.
- Click **Windsor, Ontario** to visit Toronto or Detroit. You appear as *Visitor from Windsor* and resident-only polls are restricted. Your profile does not change.
- `/map?city=miami` an empty state. `/map?demo=error` and `/map?demo=loading` show the error and loading states.
- `/bia` the BIA workspace: dashboard, members, corridor listings, offers, events, tasks and the community→BIA→outcome signal loop.
- `/business` the Business workspace (switch tenants, or `?ws=ws-biz-hardware`): claimed listings, claimable businesses, draft/publish offers, events and work queue.
- `/institution` the institution dashboard (Sample Riverside Public Library) and the school workspaces (`?ws=ws-school-elementary`, and `?ws=ws-school-academy` which is restricted and read-only). `/organization` community organizations (`?ws=ws-org-neighbours`, and `?ws=ws-org-trail` which is still onboarding). `/government` the government department workspaces (`?ws=ws-gov-public-works`, verified, and `?ws=ws-gov-parks`, still onboarding). On each, the dashboard shows what **your** role can do — roles are chosen at signup, not inside a workspace. An invited person has no access until they accept.
- `/businesses` the public business directory with claim state, and `/events` the public events view.
- `/signin` sign-in (pending / denied / expired / recovery states, all demo — but the email is really looked up in the local database now), `/signup` account creation with individual and organization branches, a role step (Resident, Business owner, BIA coordinator, Community organization member, City staff) and onboarding journeys, `/profile` the saved account when one exists (else the fixed demo profile) with privacy controls, `/settings` account, privacy, accessibility shells and a "Your role" section. Signup saves the demo account in the browser's local database (IndexedDB) on this device; the password is never stored; the role is kept in the browser session too.
- `/status` route coverage. Every required route exists, and stubs name the milestone that builds them.
- Every view is a deep link: city, lens, filters, search and selection live in the query string.

## How it is built

```text
route (page) -> feature component -> service PORT (interface) -> mock ADAPTER -> JSON fixture
                                  -> MapPort (interface)      -> MapLibre adapter | stub (tests)
```

| Path | Purpose |
| --- | --- |
| `src/app` | routes (all 33 required routes) |
| `src/features/map` | map shell, panels, dialog, URL state |
| `src/map` | `MapPort`, the MapLibre adapter (the only file that imports the library), a stub for tests |
| `src/services` | ports and mock adapters. Swap the adapters to connect real services |
| `src/lib` | shared schemas (Zod), kinds and lenses, query logic, visitor context, route inventory |
| `mock` | synthetic fixtures, validated against the schemas when loaded |
| `docs` | architecture and decisions, traceability, route matrix, RAID, evidence |

One civic-object model (`CivicObject`) drives the list, the pins and the detail view, so later feeds and dashboards can project the same objects.

## Things to know

- All people, businesses, issues and polls are invented. The **Olde Riverside corridor outline is a placeholder**: the consultation names Wyandotte Street East from Thompson to Glidden, but these coordinates are approximate and must be replaced with vetted geometry before any real use. Every outline is marked *illustrative* in the interface.
- Cluster circles do not show counts, because count labels need a hosted font service. The results list gives the numbers.
- Sign-in, onboarding, posts, polls and the rest of Layer 2 are later milestones. See `docs/RTM.md` and `/status`.

See `docs/ARCHITECTURE.md` for decisions, `docs/RAID.md` for risks and known limitations, `docs/M06_EVIDENCE.md` and `docs/M06_ROLES_AND_PERMISSIONS.md` for the current milestone, and `docs/M05_EVIDENCE.md` plus `docs/M05_WORKSPACE_CONFIG.md` for the shell it reuses.
