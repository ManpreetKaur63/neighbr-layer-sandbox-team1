# Architecture and decisions

## Shape

```text
src/app            routes (Next.js App Router)
src/features/map   MapShell (state + layout), TopBar, ResultsPanel, DetailPanel, DestinationDialog, url-state
src/map            MapPort (interface), maplibre-adapter (only importer of maplibre-gl), stub-map (tests)
src/services       ports/ (interfaces), mock/ (adapters over /mock JSON)
src/lib            schemas (Zod), kinds, query, visit, routes
```

The UI never imports a fixture or a map library directly. A real service or map provider replaces an adapter, not a component.

## Decision log

| ID | Decision | Alternatives considered | Why |
| --- | --- | --- | --- |
| ADR-001 | Next.js (App Router) + TypeScript strict, CSS Modules with design tokens, Vitest + Playwright | Tailwind; Vite SPA | Master Table names Next.js routes and a TypeScript typecheck. CSS Modules keep tokens in one `:root` block with no extra build dependency. |
| ADR-002 | Map behind `MapPort`; MapLibre GL JS adapter; civic overlays are plain data | Call MapLibre from components | Plan requires an approved map abstraction. The stub adapter in tests proves it is replaceable. |
| ADR-003 | Serve the MapLibre worker as a static file (`public/maplibre`, copied by a script) and call `setWorkerUrl` | Bundler worker import | The bundled worker failed to load under Turbopack ("Worker failed to load"). A static file works with any bundler and any later migration. |
| ADR-004 | All map state (city, lens, kinds, search, selection, outlines) lives in the URL | Component state only | Plan requires deep-link support. Also makes each view shareable and testable. |
| ADR-005 | One `CivicObject` model with geography, status, visibility, workspace and timestamps | Page-specific shapes | Plan 5.3: avoid page-specific data shapes that block later integration. |
| ADR-006 | One panel at a time (list or detail); bottom sheet on phones; one navigation dock | Stacked floating panels | The reference map stacks overlapping panels and labels. One panel manager keeps focus order and Escape behaviour predictable. |
| ADR-007 | A person keeps one fixed profile; changing city only creates visitor context | Convert the profile on travel | Shell Guide: "location change creates visitor context, not profile conversion". Office-hours demo showed *Visitor from Windsor*. |
| ADR-008 | Every boundary carries an `authority` field and every fixture is `synthetic: true`; the UI states both | Draw outlines without labels | Plan "Trust" requirement: no fabricated claims shown as real civic activity. A drawn outline must not imply a legal boundary or membership. |
| ADR-009 | OpenStreetMap raster tiles for development, attribution shown, switchable off | Paid tile service | No paid or lock-in service without written approval. OSM public tiles have a usage policy, so this suits low-volume development only. A production tile source must be chosen by Neighbr. |
| ADR-010 | Cluster circles without count labels | Hosted glyph fonts for labels | Count labels need a font server, which is an extra external dependency. The list shows counts. Revisit with Neighbr's map style. |
| ADR-011 | Pin colour is never the only cue: every pin has a list row with kind and status text, and the map has a keyboard-reachable list alternative | Colour-only legend | Accessibility requirement; non-map alternatives where appropriate. |
| ADR-012 (M05) | One reusable workspace shell + `WorkspacePort` for BIA and Business; governance rules (forward-only tasks, single claim, verified-only publishing) enforced in the port, not in components | A page per tenant type; UI-only gates | M05 is the Layer 2 reference framework for M06/M07; copying the shell per tenant would diverge it. Port enforcement keeps the rules testable and replaceable. |
| ADR-013 (M02 backfill) | Entry and profile pages are shells: pure validation in `src/lib/identity.ts`, no identity port, no storage | A fake identity port that pretends to sign users in | A mock sign-in that "succeeds" would be mistaken for real auth in review. Shells with labelled demo states show every state without faking an account system. The real identity service gets its own port when it exists. |
| ADR-014 (M06) | Per-kind configuration (`src/lib/workspace-config.ts`) drives the one shell: tabs, role names, wording and safeguards; one route can serve several kinds (`/institution` serves institutions and schools) | A shell copy or a route per organization type; a 34th `/school` route | The Project Plan lists 33 required routes and M05 said not to fork the shell. A config entry plus workspace records is the cheapest new tenant type and cannot diverge. |
| ADR-015 (M06) | One pure permission rule (`decide`: role x invitation state x workspace access state) shared by the UI and the mock port; mutations take an optional actor; a restricted workspace rejects every change | UI-only disabled buttons; separate rules per tenant type | The rule is testable in one place and the port rejects what the UI hides (closes M05-D3 for the mock). It is not security: there is no authentication, so the "view as" switch is a demonstration. |
| ADR-016 (M07) | Offices and departments are two more `WorkspaceKind`s served by `/representative`, configured in `KIND_CONFIG` (`governed: true` adds Cases, Communications, Public view and Audit tabs) | A 34th route per kind; a new shell | Same reasoning as ADR-014: the plan fixes 33 routes and the shell must not fork. |
| ADR-017 (M07) | Governance lives behind its own `GovernancePort` with a store shared between pages and saved in the browser session; rules are pure (`src/lib/governance.ts`) and used by both screens and port | Extend `WorkspacePort`; separate stores per page | A case routed on the office page must exist on the department page. Pure rules mean the disabled button and the refusal say the same sentence. |
| ADR-018 (M07) | Audit is append-only inside the port; a refusal for permission or rule reasons is recorded, plain input errors (empty note) are not | Log only successes; log everything | Reviewers need to see what was tried. Empty-field errors are not attempts at a governed step. |
| ADR-019 (M07) | Four-eyes: approving publication needs the owner role and a person other than the author | Any publisher approves | Public communication from a government body needs a second check. Enforced in the port, shown on screen. |

## Extension points for later milestones

- M05 landed the workspace port and shell (see `docs/M05_WORKSPACE_CONFIG.md`). M06 configured institution, school and community organization from it (`docs/M06_EVIDENCE.md`); M07 did the same for public offices and government departments (`docs/M07_EVIDENCE.md`). Do not fork the shell.
- Workspace context resolves explicitly from the route (`?ws=`) or, without one, the first workspace of that kind. There is no silent default-tenant fallback.
- `MapPort` already supports overlays as data. Layer 2 workspaces add boundaries and markers through it.
