# M02 Evidence — Entry, Onboarding & Fixed Profiles (backfill)

## Honest status first

- **M02's portal week ended Sunday 4 Oct 2026.** These shells were built on
  25 Oct 2026, inside the M01–M05 merge, so any M02 deposit made from this
  code must be marked **LATE with its real date — never backdated**.
- These are **shells, not accounts**: there is no real authentication, no
  account storage and no profile persistence. That was the M02 plan
  ("sign-in/account shells"), and this evidence does not claim more.
- This code was **not teammate-reviewed** when built, and the portal
  forbids depositing unreviewed generated code. Team review, PR/CI links,
  screenshots and a clean-clone check on a team machine are still team-only
  steps before any deposit.

## What was built (all in this codebase)

| Route | What it does | States shown |
| --- | --- | --- |
| `/signin` | Sign-in form with email/password validation; preview buttons for the other states | form, pending, denied, expired, recovery, success, field errors |
| `/signup` | Branch choice (individual / organization) → details → review → done, with the branch's onboarding journey listed | branch, form, validation errors, review, done |
| `/profile` | Fixed demo profile from the mock session (Demo resident, Windsor) + privacy toggles in page state only | loading, error, success |
| `/settings` | Account, privacy and accessibility groups | success, error (empty name / bad email) |

Shared rules live in `src/lib/identity.ts` (pure functions, no UI):
`validateEmail`, `validatePassword`, `validateSignIn`, `validateSignUp`,
`onboardingSteps`. The header now links to `/signin` and `/profile`, so
entry is reachable from every page, not just by typing a URL.

## Cross-journey checks (what to click)

1. `/signup` → choose Organization → fill in → review → done → **BIA
   workspace** and **Business workspace** links both work.
2. `/signin` → submit a valid-looking form → success → **View your
   profile** → `/profile` shows Demo resident, Windsor.
3. `/profile` → **Open the map** → switch city on `/map` → you appear as a
   visitor; going back to `/profile` still shows Windsor (fixed profile,
   ADR-007 — city change is visitor context, not profile conversion).
4. `/map` → a business record's detail panel → **Open in workspace** →
   `/bia` or `/business` (M05 journey, unchanged by this merge).

## Checks run (25 Oct 2026, Node 24.22.1, in this workspace — not a clean clone)

- `npm run lint` — 0 errors
- `npm run typecheck` — pass
- `npm test` — **77 tests pass** (72 from M03–M05 + 5 new in
  `tests/unit/identity.test.ts`)
- `npm run build` — prerenders all **35 routes** (33 required routes + `/`
  + `/_not-found`)

## Route inventory after the merge

33 routes: **16 built, 2 partly built, 15 stubs** (was 12 / 2 / 19 before
the M02 backfill). Still stubs, honestly: groups, messages, marketplace,
institution, organization, representative, admin routes, help, privacy,
terms, accessibility. M06 (institution, community organization, school)
starts Mon 26 Oct 2026 and extends the M05 workspace shell — it does not
rebuild it.

## [TEAM] — to fill before any deposit

- [ ] Teammate review of this merge (name + date):
- [ ] PR link: 
- [ ] CI link / status:
- [ ] Screenshots (signin states, signup branches, profile, settings):
- [ ] Clean-clone check on a team machine (date, machine):
- [ ] Portal tag for the deposit: `week-02-onboarding-profiles` (portal tag,
      not the short internal tags), deposit marked LATE with the real date:
