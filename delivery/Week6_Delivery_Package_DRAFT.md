# Week 6 Delivery Package — Connected Journeys (DRAFT for team review)

**Team:** [TEAM — resolve "Team 1" vs "NeighbrX / team 4" label before submitting]
**Week:** 6 of 10 (Oct 26 – Nov 1, 2026) · **Portal tag:** `week-06-institution-community-school`
**Prototype:** `neighbr-shell-m01-m06-updated.zip` (M01–M06 merged codebase)
**Status of this document:** DRAFT — the team must review, fill every [TEAM] slot, add real screenshots, and record real test sessions before anything is submitted.

## 1. How to open the prototype

1. Extract the zip (folder inside is `neighbr-shell-m03`).
2. In a terminal inside that folder: `npm install`, then `npm run dev`.
3. Open http://localhost:3000.

Automated checks on this code (run Nov 1, 2026): lint 0 errors, typecheck pass, **106/106 unit tests pass**, production build prerenders all 35 routes. Route inventory: **18 built / 2 partly built / 13 stubs** (see `/status` in the app, or `docs/ROUTE_MATRIX.md`).

## 2. Complete wireframe — all three layers

Graphical version: **`Week6_Wireframe.html`** (open in a browser; screenshot it or print to PDF for the submission). Text version below. Everything listed exists as a route; Layer 3 screens marked DRAFT are stubs awaiting M08.

```text
LAYER 1 — Resident map & community activities        (BUILT)
  /map ── search, filters, lens, pins, detail panel ──┐
  /pulse ── feed: posts, issues, polls ────────────────┤
  /issues/report ── file a report ────────────────────┤
  /notifications ── updates for the resident ─────────┤
  /events, /alerts, /businesses ── community surfaces ┘
            │  "Open in workspace" (map detail panel)
            ▼
LAYER 2 — Business, BIA & organization workspaces    (BUILT)
  /bia ── BIA workspace: dashboard, members, listings, offers, events,
           tasks (work queue), signal-loop outcome card, Roles & access
  /business ── business workspace (?ws= selects tenant)
  /institution ── institution + school workspaces (?ws= selects tenant)
  /organization ── community organization workspace
  Every workspace: "View as" demo role switch · Roles & access tab
            │  (M08) activity review & follow-up
            ▼
LAYER 3 — Staff & administration                     (DRAFT — stubs)
  /admin ── staff home                                [DRAFT]
  /admin/users ── manage access                       [DRAFT]
  /admin/content ── review activity                   [DRAFT]
  /admin/audit ── audit trail                         [DRAFT]
  /admin/system ── system                              [DRAFT]
```

Identity & profiles (`/signin`, `/signup`, `/profile`, `/settings`) are demo shells — no real accounts.

## 3. Journey A — one complete journey, fully built (business → BIA → business)

Follow these steps in order; each step's screenshot goes in the box.

**Step 1 — See the request on the map.**
Open `/map`, find "Roadworks affecting shop access". The detail panel shows its status ("Acknowledged") and an **"Open in workspace"** link.

[SCREENSHOT 1: map detail panel for the roadworks issue with "Open in workspace" visible]

**Step 2 — Arrive in the BIA workspace.**
Clicking the link opens `/bia?ws=ws-bia-sample` — the Sample Olde Riverside BIA workspace. The Overview tab shows the **"Signal loop: community → BIA → outcome"** card.

[SCREENSHOT 2: /bia Overview with the signal-loop card]

**Step 3 — The coordinator acts (role-aware).**
Use the **"View as (demo role switch)"** to act as the Demo corridor coordinator (staff). Open the **Tasks** tab and advance "Track roadworks affecting shop access" from in-progress to **done**. (Tasks move forward only — open → in-progress → done — enforced in code, with tests.)

[SCREENSHOT 3: Tasks tab, task marked done]

**Also in the work queue:** the coordinator can **Decline** a request (a reason is required and recorded; declined requests stay closed) or send it back with **Request info** (it returns to open once the information is provided). Both are role-gated like everything else.

**Step 4 — The outcome reaches everyone.**
Back on Overview, the signal-loop card now reads: **"Demo outcome published: shops notified — see the market alert on the map"**, linking to `/map?sel=w-alert-market`. The same journey works in reverse: map → workspace → map.

[SCREENSHOT 4: outcome card + the market alert on the map]

**Step 5 — Who can view or change it.**
Open the **Roles & access** tab: the role matrix shows owner/staff/member permissions, and switching "View as" to an invited person shows **"No access yet"**. Attempting a disallowed action shows **"Not allowed: …"** with the reason.

[SCREENSHOT 5: Roles & access tab]

## 4. Journey B — one example through all three layers

Steps 1–2 and 4 run on the built prototype; **Step 3 is a draft screen** (simple wireframe, sample data), because the admin layer is built in M08.

**Step 1 (L1) — Resident reports.** `/issues/report`: file a report (title + summary). It appears in the `/pulse` feed. (Filed reports live in memory for the demo session.)

**Step 2 (L2) — Organization handles it.** The BIA coordinator sees the related work item in the `/bia` Tasks tab and advances it, as in Journey A.

**Step 3 (L3 — DRAFT) — Staff reviews and follows up.** Draft wireframe for `/admin/audit`: a staff member reviews the activity trail (who viewed/changed the request, its status history) and records a follow-up action. [DRAFT SCREEN — not built; simple wireframe with sample data is attached/approved as draft.]

**Step 4 (L1) — The resident is updated.** The resident sees the update in `/notifications` and the outcome on the map.

## 5. Test record — what we tested, what we learned, what we changed

**Automated (verified Nov 1, 2026):** 106 unit/component tests pass; production build prerenders all 35 routes; lint and typecheck clean. (Playwright e2e not run — needs Chromium on a team machine.)

**Walkthrough testing — [TEAM: fill in real sessions; do not invent these]**

| Date | Who tested | Journey walked | What was confusing or broken | What we changed |
| --- | --- | --- | --- | --- |
| [TEAM] | [TEAM] | Journey A | [TEAM] | [TEAM] |
| [TEAM] | [TEAM] | Journey B (L3 draft) | [TEAM] | [TEAM] |

**Learned and changed during the build (from the evidence docs, already in code):**
- Restricted workspaces had a badge but no behaviour → the port now rejects every change in a restricted workspace (tests cover it).
- Role checks were display-only → the mock port now enforces the same `decide()` rule the UI shows; "View as" is labelled a demonstration, not security.
- The new tenants deliberately have no map pins yet, to avoid breaking the map count tests — pins will be added with derived counts later.

## 6. Declined / more information needed / no permission

| Situation | What happens in the prototype | Status |
| --- | --- | --- |
| Someone tries an action their role disallows | Control is disabled with the reason; the port rejects with **"Not allowed: …"** (e.g. a member cannot publish; only owner/staff can) | **Built** — try it with "View as" |
| Invited person who hasn't accepted | Sees **"No access yet"** on every workspace tab | **Built** |
| Restricted workspace (e.g. the language academy) | Read-only for everyone, including owners | **Built** |
| Onboarding workspace tries to publish | Publish is blocked: only verified workspaces can publish | **Built** |
| A request is **declined** | Coordinator clicks **Decline**, gives a reason (required); the request shows "declined" with the recorded reason and stays closed | **Built** — try it with "View as" staff |
| **More information is needed** on a request | Coordinator clicks **Request info** with a note; the requester sees what is needed and clicks **Provide info** to return it to open | **Built** — try it with "View as" staff |

## 7. What works, what is simulated, what remains to be built

**Works:** all Layer 1 community surfaces; all four Layer 2 workspace kinds on one reusable shell; member/invite/role management; forward-only task workflow; verified-only publishing; single-claim listings; map ↔ workspace deep links in both directions; role-gated permissions enforced in the port.

**Simulated:** sign-in and identity ("View as" role switch — labelled a demonstration, not security); all people, businesses, issues and data are invented fixtures; filed reports, votes and outcome cards live in memory and reset on refresh; the BIA signal-loop outcome is a labelled demo outcome, not a real civic outcome.

**To be built:** Layer 3 admin screens (`/admin/*` — M08, Nov 9–15); task assignment to a person (M07); public-office/government workspace (M07); real backend replacing the mock adapters (program continuation).

## 8. Updated plan to the final deliverable (Nov 30, 2026)

| Week | Dates | Focus | Owner | Done when |
| --- | --- | --- | --- | --- |
| M06 | Oct 26 – Nov 1 | **This delivery:** connected journeys, Layer 2 completion, permission demos | [TEAM] | Journeys walkthrough + this package reviewed and deposited |
| M07 | Nov 2 – Nov 8 | Public office & government workspace; task assignment to a person; extend Journey B's L3 step toward a working draft | [TEAM] | `week-07-public-office-government` deposited |
| M08 | Nov 9 – Nov 15 | Operations shell: build the Layer 3 admin screens (access, activity review, audit, task tracking, follow-up) | [TEAM] | `week-08-operations-shell` deposited |
| M09 | Nov 16 – Nov 22 | Stabilization: close open defects (dead workspace link, map pins for new tenants), e2e + accessibility pass | [TEAM] | `week-09-stabilization` deposited |
| M10 | Nov 23 – Nov 29 | Final release & handover: evidence index, delivery notes, continuation package | [TEAM] | `week-10-final-release` deposited |
| Final | **Mon Nov 30** | Present complete shell + final tagged release | [TEAM] | Gate review |

Backlog carried honestly: M02–M05 teammate reviews, PR/CI links, tags, screenshots and clean-clone checks are still open and are not closed by this package.

---

**Checklist before this package is submitted — [TEAM]:**
- [ ] All [TEAM] slots above filled with real names, dates and sessions
- [ ] Screenshots 1–5 captured and placed
- [ ] L3 draft wireframe for `/admin/audit` drawn (simple boxes + sample data is fine)
- [ ] Teammate review of this document and the prototype (portal rule: no unreviewed generated material)
- [ ] Weekly controls report for Week 6
- [ ] Tag `week-06-institution-community-school` in the team repo; deposit via the portal by the designated uploader
