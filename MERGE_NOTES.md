# Governance merge notes — Saloni Patel's M07 governance layer into fateh's Week 7 tree

Date: 11 Nov 2026. Merge plan: `Governance_Merge_Plan_M07_M08.md` (9 Nov 2026).
Inputs (untouched): fateh's M07 tree `~/workspace/neighbr-shell-m03/` (161/161 tests, 20 files, build 36 routes as recorded;
the route directories are 34 in both trees) and Saloni's M07 tree `~/workspace/saloni-tree/neighbr-shell-m03/`
(191/191 tests, 19 files). Saloni's re-uploaded zip (`neighbr-shell-m01-m07_0_3mgy.zip`) is byte-identical to her
Nov 8 zip (md5 `f8b1d6d92a633945afbf15309156f84b`), so the existing `saloni-tree/` is the uploaded code.

## Base state (verified 11 Nov, ~1:52 PM EST)

Manpreet merged the Week 7 PR — **PR #5 (`week7-government` → `main`), merged by ManpreetKaur63 at 1:51 PM EST,
merge commit `43978f1`** (72 files, +4,789/−1,572). **Main is now the updated branch** and contains the Week 7 code.
The `week7-government` branch still exists but is done — the new merge branch must be created from the **updated main**,
not from `week7-government`. See `delivery/Merge_Push_Steps.md`.

**Open item:** the PR #5 page showed **"1 check failed"** (which check is unknown). It did not block the merge, but the
team should look at which check failed before relying on CI for this branch.

## Design decisions (from the plan; unchanged)

- **No ward-office tenant.** Public Works acts as the department. Do NOT add `office`/`department` kinds — fateh's
  single `government` kind only.
- **Requests and GovCases stay separate.** Resident reports do not become GovCases.
- **ADR-017/018 kept:** no `RolesPanel.tsx` (not copied), `/representative` stays a profile page, no "View as" switch,
  no Roles & access tab.
- **Saloni's four-eyes publication rule kept as-is** (a second person, who did not write the item, must approve it).
- **Gov tabs (cases, communications, public, audit) on the `government` kind only.**

## What was ported as-is

- `src/lib/governance.ts` — pure rules: `canReceiveCases`, `decideCaseStep`, `decideApproval`, `decideCommStep`,
  `isPublic`, `auditCsv`, publication/case labels.
- `src/services/mock/governance.ts` — the governance store, seeds, and `createGovernancePort` (see "Adaptations").
- `src/components/gov/` — all 9 files: `GovCommon`, `useGovData`, `GovDashboard`, `CasesPanel`, `CommsPanel`,
  `PublicView`, `AuditPanel`, `CaseTasks`, `gov.module.css` (see "Adaptations").
- The 3 governance test files — **rewritten for the merged tenant model** (see "Tests"), not copied verbatim.

## What was hand-merged

| File | Change |
| --- | --- |
| `src/lib/schemas.ts` | Saloni's `GovCase`/`Communication`/`AuditEntry` schemas (+ case status/source/priority, publication state, audit action) inserted after `civicRequestSchema`; fateh's kind enum (`government` only) and onboarding schemas kept. |
| `src/services/ports/index.ts` | `GovernancePort` interface + `governance` on `Services` added. Note: the port has **no `auditCsv`** — the CSV is built client-side by the pure `auditCsv(entries)` in `src/lib/governance.ts` (see `AuditPanel`). |
| `src/services/mock/index.ts` | Governance import, `MockOptions.governanceStore`, `governance: createGovernancePort({ store: governanceStore, workspaces, wait })` in the return. Fateh's 2 tenants/members/tasks/programs kept. |
| `src/lib/workspace-config.ts` | `WorkspaceTab` gains `cases \| communications \| public \| audit` (no `roles`); `KindConfig` gains `governed?: boolean`; the government kind is `governed: true` with tabs overview, cases, communications, public, members, programs (Services), requests, events, tasks, audit. `ROUTE_KINDS` unchanged. |
| `src/components/WorkspaceClient.tsx` | Gov imports; `?tab=` initial tab state; `openCaseId`/`draftCaseId` state; `governed = config.governed === true`; `govActor` built from fateh's resolved actor (no picker — ADR-017); `GovDashboard` in the overview when governed (all fateh overview content kept); gov tab sections for cases/communications/public/audit; `CaseTasks` in the Tasks tab when governed. |
| `src/components/WorkspaceShell.tsx` | Unchanged (no "View as" props). |
| `src/app/globals.css` | Saloni's M07 mobile block appended whole (with a comment: the `.switcher`/`.viewAs`/`.tabs` selectors are currently unused in the merged tree — fateh's shell kept, no picker — kept as-is to avoid a partial copy; the media queries are the live part). |
| `src/app/status/page.tsx` | Milestone text updated to M01–M07 with the governance merge noted. |
| `src/lib/routes.ts` | `/government` summary updated to mention cases/communications/public view/audit record. |
| `src/lib/workspace.ts` | Fateh's kept (`ws-gov-` routing, M06-D3). |
| `src/app/representative/page.tsx`, `src/app/issues/report/ReportIssueClient.tsx`, signup/signin/profile/settings, `identity.ts`, `session.ts`, `onboarding-db.ts` | Fateh's wholesale, no change. |
| `src/components/SiteHeader.tsx`, `SiteHeader.module.css` | Fateh's kept. Saloni's version drops the `/government` header link and adds a mobile Menu button; out of scope for this merge — possible follow-up. |
| `src/lib/workspace.ts` | Fateh's kept. |
| `docs/evidence/m07/` | 17 of Saloni's M07 screenshots copied (`01-…`–`17-…`); `18-roles-phone.png` left out (shows the Roles tab, removed by ADR-017). **Caveat:** they were captured against her parallel tree (office/department model, `/representative` workspace, "View as" picker), so they show the gov panels with office/department labels — fresh screenshots of the merged `/government` tabs are still to be taken. Her `capture-screens.mjs` was NOT copied (it drives her routes/kinds and would not reproduce these shots here). |
| Docs | `docs/M07_EVIDENCE.md` (merge addendum), `CHANGELOG.md` (merge entry), `docs/ARCHITECTURE.md` (**ADR-020**), `README.md` (`/government` line + M07 paragraph). `docs/ROUTE_MATRIX.md` route count unchanged (34 routes). |

## Adaptations (the plan's "clean port-in" assumption was wrong)

The plan said the 3 gov test files were clean port-ins and the `GovernancePort` "runs against fateh's government
tenants without a kind change". Neither is true:

- The port tests asserted Saloni's tenant model (2 offices + 4 departments, `ws-ward-sample`/`ws-dept-works`/…,
  specific seed ids/titles) — none of which exist in the merged tree.
- The UI test rendered `<WorkspaceClient kind="office" kinds={ROUTE_KINDS['/representative']} />` with a "View as"
  picker — neither exists in the merged tree.
- The mock enforces kind gates: `createCase` required kind `office`, `createCommunication` required
  `office`/`department`, `canReceiveCases` required kind `department` — so in the merged tree (kind `government`
  only) **all governance mutations would have been refused and the gov tabs read-only**. `useGovData` loaded only
  departmentId cases for a non-office workspace, so received (unrouted) cases would have been invisible on
  `/government`.

Because these adaptations are forced by the already-made decisions (no ward office → Public Works must be able to
log/route/receive cases), the merge proceeded with targeted adaptations instead of stopping. Every one is listed here:

- **`src/services/mock/governance.ts` (seeds):** office `ws-ward-sample` → `ws-gov-public-works`; `ws-dept-works`/
  `ws-dept-parks` → `ws-gov-public-works`; member ids re-pointed (m-ward-1/m-works-1 → m-gov-1 owner; m-ward-2/3,
  m-works-2/3, m-parks-2 → m-gov-2 staff; m-ward-4/m-works-4 → m-gov-3 member; m-ward-5/m-works-5, m-parks-3 → m-gov-4
  invited; m-parks-1 → m-prk-1 parks head); seed objectIds (w-sidewalk, w-roadworks, w-trail, w-streetlight) verified
  to exist in fateh's `mock/objects.json`; audit `visibleTo` arrays deduped where office and department collapsed to
  the same workspace; case-1005 return detail rewritten ("needs more information before it can be routed again");
  "Sample Public Works Department" → "Sample City of Windsor — Public Works".
- **`src/services/mock/governance.ts` (gates):** kind gates simplified to `kind !== 'government'` checks with
  merged-model refusal messages ("Only a government workspace logs cases.", "Only a government workspace writes
  public communications here.").
- **`src/lib/governance.ts`:** `canReceiveCases` accepts kind `government` as the department (other kinds refused
  with the same "is not a department" reason).
- **`useGovData`:** simplified to always load both officeId and departmentId cases, deduped, re-sorted newest first.
- **`GovDashboard`:** simplified to government behavior (waiting = received/returned/routed; tiles "Waiting for a next
  step" / "In progress" / "Urgent and open" / "Awaiting approval" / "Published" / "Refused attempts"; heading
  "Case pipeline"; button "Open and work"; "See what the public sees" shown).
- **`CasesPanel`:** government logs cases and takes all four steps (route/accept/return/close); route targets are
  government-kind workspaces; heading "Cases"; `officeId` is the selected case's office (a case logged by Parks
  keeps Parks as its office); NewCase always shown; empty state "No cases yet. Log one above."
- **`CommsPanel`:** noun "Communications"; "Write a draft notice".
- **`CaseTasks`:** government filter = any non-closed case; titles Route/Accept/Work by status.
- **`PublicView`:** verified-tag wording "✓ Verified office" → "✓ Verified" (kind-agnostic otherwise).
- **Tests:** `governance-port.test.ts` rewritten for the merged tenants/seeds (2 government workspaces; `w-ward` →
  `ws-gov-public-works`; Parks onboarding is the refusal target; no restricted tenant — the restricted-route assertion
  dropped; no separate office — the "only an office logs cases" assertion is now "only a government workspace logs
  cases"); `governance-ui.test.tsx` rewritten for `/government` (kind `government`, `ws=ws-gov-public-works`, city-staff
  role → m-gov-2; no "View as" picker; dashboard counts with merged seeds: waiting 4, in-review 1, published 2;
  public view withheld 2 draft / 1 in review / 1 returned / 1 withdrawn / 6 internal cases; route-to-Parks refused as
  onboarding; staff sees approval disabled with reason; audit tab + CSV; Tasks tab case tasks; restricted-department
  test dropped); `governance-rules.test.ts` fixtures adapted (office/department fixtures → `government` workspaces,
  non-department → `business`); `permissions.test.ts` gained gov-tab assertions (government has cases/communications/
  public/audit, `governed === true`, only government is governed, no `roles` tab anywhere); `m07-government-roles.test.ts`
  updated on purpose (the government tab list now includes the 4 gov tabs).

Two plan assumptions corrected during the merge:

- **`auditCsv` is not on the port in either tree.** The CSV is built client-side by the pure `auditCsv(entries)` in
  `src/lib/governance.ts` (`AuditPanel` line 30). The port exposes only `audit`. The "exposes no way to edit or
  delete" test was corrected to match (audit-only keys, no edit/delete keys).
- **The append-only test reads the raw store**, not the `audit()` result (which returns newest-first, so its seqs run
  13…1). The raw store is oldest-first and its seqs rise 1…n.

## Verification (real runs in this tree, 11 Nov 2026)

| Gate | Result |
| --- | --- |
| `npm install` | OK (no new runtime dependency; `fake-indexeddb` was already a devDependency) |
| `npm run lint` | **0 errors** |
| `npm run typecheck` | **Pass** |
| `npm run test` | **218/218 tests, 23 files** (fateh's 161 + 57 governance tests, as rewritten; the plan's ~218 estimate landed exactly) |
| `npm run build` | **Compiled successfully; 35 pages (34 routes + `/_not-found`)** — the route directories are identical to fateh's M07 tree (34, diff clean). The plan's "36 routes" estimate counted `/` twice; the real count is 35 prerendered pages. |

Playwright e2e + axe scan **not run**. Not teammate-reviewed.

## Known limitations / open items

- **Owner-only steps are unreachable in the UI:** the onboarded city-staff role resolves to m-gov-2 (staff), never to
  the owner m-gov-1, so approving a publication shows as unavailable with the reason. Four-eyes is covered by the
  port tests, not by the UI. (A future step could add an owner role choice, or a test-only way to act as the owner.)
- **No restricted government tenant exists**, so the restricted-state rules are covered only by
  `governance-rules.test.ts` and `permissions.test.ts`, not by a gov port/UI test.
- **Fresh screenshots of the merged `/government` tabs** (both tenants) are still to be taken — the 17 copied shots
  are from Saloni's parallel tree (see above).
- **PR #5 "1 check failed"** — which check failed is unknown; look at it before relying on CI for this branch.
- **Teammate review** (Manpreet, reviewer) is still required before deposit — portal rule: no unreviewed generated code.
- The merge branch is `week7-governance`, from the **updated main** (see `delivery/Merge_Push_Steps.md`). Do not merge it
  yourself; Manpreet reviews.
- **Week 7 portal deposit is still LATE** (due Sun Nov 8, 11:55 PM ET, tag `week-07-public-office-government`) — this
  merge does not deposit anything. Week 6 deposit is also still LATE.
