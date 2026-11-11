# HireMeBot — Frontend

Mobile-first React PWA for the HireMeBot student authentication, onboarding and
dashboard. Built with Vite, TypeScript, Tailwind CSS, Radix primitives, and
TanStack Query. Sign-in uses **Amazon Cognito + Google** through AWS Amplify
v6; see [`docs/COGNITO_GOOGLE_AUTH.md`](docs/COGNITO_GOOGLE_AUTH.md) for the
integration, its limits, and production steps.

| Doc | What it covers |
| --- | --- |
| [`docs/COGNITO_GOOGLE_AUTH.md`](docs/COGNITO_GOOGLE_AUTH.md) | Google sign-in, account lookup/registration flow, token storage, production checklist |
| [`docs/API_AND_CACHING.md`](docs/API_AND_CACHING.md) | Student dashboard API call, TanStack Query cache, refresh/invalidation |
| [`docs/BACKEND.md`](docs/BACKEND.md) | Backend endpoints the frontend uses today, Cognito settings, deferred work |

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the VITE_COGNITO_* values
npm run dev
```

Then open http://localhost:5173 (the Cognito callback is registered for this
exact origin).

`npm run dev` first runs `scripts/generate-sample-docs.mjs` (the `predev`
hook), which writes the sample resume/cover-letter PDFs used by the mock data.

**Backend and data source.** `VITE_STUDENT_API_MODE` selects where the student
dashboard data comes from:

- `mock` (default) — in-process sample data, no backend needed.
- `live` — calls the real backend (`VITE_API_BASE_URL`, or the Vite `/api`
  proxy when empty). The student is **whoever signs in**: their `studentId`
  (returned by `GET /api/v1/auth/me`) is sent as the dev-only
  `X-Dev-Student-Id` header. There is no student ID in `.env.local`. Live mode
  is refused in production builds.

Signing in always uses **real** Cognito Google sign-in plus the account API
(`GET /api/v1/auth/me`, `POST /api/v1/students/register`), in both modes, so a
reachable backend is needed even in mock mode: set `VITE_API_BASE_URL` (or the
two `VITE_ACCOUNT_*` URLs), or leave them empty to go through the Vite `/api`
dev proxy (default target `http://127.0.0.1:3000`). The signup phone step is
simulated:

- **Development-only OTP code**: `123456` (only in `npm run dev`; it does not
  exist in production builds and never marks a phone as verified).
- Production builds skip the OTP form and tell the user SMS verification is
  not available yet.

## Scripts

| Command             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR                          |
| `npm run build`     | Regenerate assets, type-check and produce a production build (incl. PWA) |
| `npm run preview`   | Preview the production build locally                        |
| `npm run typecheck` | Run only TypeScript project references                      |
| `npm run test`      | Run the Vitest suite once                                   |
| `npm run test:watch`| Run Vitest in watch mode                                    |
| `npm run icons`     | Regenerate the PWA icons (`scripts/generate-icons.mjs`)     |
| `npm run samples`   | Regenerate the sample documents (`scripts/generate-sample-docs.mjs`) |
| `npm run assets`    | `icons` + `samples` (runs automatically before `build`)     |

`npm run lint` is listed in `package.json` but does not work yet: ESLint 9 is
installed and there is no `eslint.config.*` file.

## Project structure

```
src/
├── app/              App shell (App.tsx routes), ThemeProvider
├── components/
│   ├── common/       Logo, backdrop, ToastProvider, theme toggle, Google mark, ComingSoonDialog
│   ├── layout/       AuthLayout, StudentLayout
│   └── ui/           Button, Input, Checkbox, Select, Label, Dialog, Badge primitives
├── features/
│   ├── auth/         AuthProvider, account state, pages, OTP components,
│   │                 services (Amplify/Cognito, account API, signup draft,
│   │                 redirect intent, phone verification), zod schemas
│   └── student/      Dashboard pages, hooks (TanStack Query), data layer
│                     (HTTP helper, mock/live service), date/target helpers
├── lib/              env.ts (typed VITE_* reader), utils (cn, maskPhone, sleep)
├── routes/           Route guards + NotFound page
├── styles/           Global Tailwind layer + CSS variables
└── test/             Vitest setup, in-memory Amplify + account-API fakes, render helpers
```

## State management

There is **no Redux, Zustand or other global store**. State is split by where
it comes from:

| State | Where it lives | Lifetime |
| --- | --- | --- |
| Cognito tokens (ID / access / refresh) | **Amplify**, in `sessionStorage` | Page refresh survives; tab close ends the session. App code never copies tokens. |
| Signed-in identity (`user`) and backend account (`account`, incl. `account.student.studentId`) | `AuthProvider` React Context (`useState`) | In memory only; rebuilt from the Amplify session + `GET /auth/me` on every app start, Google sign-in and tab refocus |
| Student dashboard response (stats, applications, `data.student`) | TanStack Query cache, key `['student-dashboard', <studentId>]` | In memory; 1 h fresh, 2 h GC, hourly refetch while visible, midnight invalidation; cleared on logout |
| Theme | `ThemeProvider` Context | Persisted in `localStorage` (`hiremebot-theme`) |
| Toasts | `ToastProvider` Context | In memory, 4 s auto-dismiss |
| Signup form draft | `sessionStorage` `hmb.onboarding.draft` | 30 min TTL; cleared on registration, restriction, conflict and logout |
| OAuth redirect intent (flow + return path) | `sessionStorage` `hmb.auth.redirectIntent` | 15 min TTL |
| Forms and UI state (pagination, search, dialogs, tabs) | Component-local `useState`; signup form uses react-hook-form + zod | Component lifetime |

How the pieces connect: after Google sign-in, `AuthProvider` asks the backend
who the identity is (`GET /auth/me`). The answer (`account.status`:
`none | unregistered | pending | active | restricted | error`) drives routing
through the guards. For an `active` student, `account.student.studentId` is
passed to the dashboard query, which both scopes the cache key and is sent in
the request header. Nothing about the account is persisted, so a suspension
takes effect on the next lookup. Details: [`docs/COGNITO_GOOGLE_AUTH.md`](docs/COGNITO_GOOGLE_AUTH.md)
and [`docs/API_AND_CACHING.md`](docs/API_AND_CACHING.md).

## Theming

- Themes: `light`, `dark`, and `system` (default). The chosen value persists
  in `localStorage` under `hiremebot-theme`.
- The initial theme is applied synchronously in `index.html` to avoid a flash
  of the wrong theme on first paint.
- Colors are defined as HSL CSS variables in `src/styles/globals.css` and
  consumed through Tailwind tokens — no hardcoded hex values in components.

## Mobile & PWA

- Viewport is `width=device-width, initial-scale=1, viewport-fit=cover` with
  safe-area padding utilities (`.safe-top`, `.safe-bottom`).
- Bottom navigation only appears on authenticated student routes.
- Service worker is generated by `vite-plugin-pwa` with `registerType:
  autoUpdate`. **It never caches API responses or JWTs** — `/api/*` and
  `/auth/callback` are in the `navigateFallbackDenylist`, `/api/*` has an
  explicit `NetworkOnly` runtime rule, and no rule targets authenticated
  requests.
- Install prompt is handled by the browser; valid icons at 192/512 and a
  maskable 512 variant are generated by `scripts/generate-icons.mjs`.
- `vercel.json` rewrites every path to `index.html` so deep links such as
  `/auth/callback` survive a full reload.

## Authentication

- `src/features/auth/amplifyConfig.ts` — configures Amplify once at startup
  (tokens in `sessionStorage`).
- `src/features/auth/services/authService.ts` — Google sign-in, session,
  tokens, sign-out, and OAuth callback completion.
- `src/features/auth/services/studentAccountApi.ts` — `GET /api/v1/auth/me`
  and `POST /api/v1/students/register`, sent with the Cognito access token as
  a Bearer token.
- `src/features/auth/AuthProvider.tsx` — React auth state: `user`,
  `isAuthenticated`, `account`, `isLoading`, `error`, plus `loginWithGoogle`,
  `logout`, `refresh` and `registerStudent`.
- `src/features/auth/account.ts` — `AccountState`, `routeForAccount()` (the
  single "where does this account belong?" rule) and `studentIdFromAccount()`.
- `src/routes/guards.tsx` — guards driven by `account.status`: `/student/*`
  requires an `active` student.
- `src/features/auth/services/phoneVerification.ts` — phone verification
  seam; development uses `mockOtpService.ts`, production reports it as
  unavailable.

Full details: [`docs/COGNITO_GOOGLE_AUTH.md`](docs/COGNITO_GOOGLE_AUTH.md).

## Testing

```bash
npm run test
```

Vitest + React Testing Library (31 files, 274 tests at the last run) cover:

- `signupSchema` validation (names, terms, phone normalization)
- Cognito auth service, Amplify config, OAuth callback, auth provider, and the
  signup → phone step → Google → register flow (against in-memory Amplify and
  account-API fakes)
- The account API client (`/auth/me`, `/students/register`, error mapping)
- Development-only mock OTP (and its rejection in production builds)
- `OtpInput` typing, paste, non-numeric filtering, `onComplete`
- `useResendCountdown` ticking + restart
- `ThemeProvider` dark class + persistence
- Route guards redirecting by account status
- Student dashboard: shared cache (one request across pages), profile as a
  selector over the dashboard query, midnight invalidation, refetch-error
  banner, logout cache isolation, and the live HTTP helper (including that the
  signed-in student's `studentId` is what gets sent)
- Environment guards (live mode refused in production builds)

## Student dashboard

Screens under `/student/*`. They are reachable only by a registered, `active`
student (see the guards), in both mock and live mode. All of them read from the
single dashboard query documented in
[`docs/API_AND_CACHING.md`](docs/API_AND_CACHING.md).

- `/student/dashboard` — greeting from `data.student`, monthly and today's
  progress cards (server-supplied values), statistics cards (the In Review /
  Interviews / Offers tiles are previews that open a shared `ComingSoonDialog`),
  weekly activity chart, and a Refresh button
- `/student/applications` — "Today's Applications": search by company or job
  title across **all** pages, client-side pagination, empty state, and a
  "showing previously loaded data" banner if a refresh fails
- `/student/applications/:id` — company header, job-posting link, job details,
  resume / cover-letter document links, and an "unavailable" state
- `/student/profile` — name, email, phone and verification from
  `data.student` (never from the Cognito session); Theme cycles System → Light
  → Dark; Help, Privacy and Terms open placeholder dialogs; Edit opens a
  coming-soon dialog; Sign out
- `/student/notifications` — All / Application Updates / System tabs, each
  rendering a tab-specific empty state (no fake notification records)

### Targets math

`src/features/student/lib/targets.ts` holds pure helpers
(`countWeekdaysInMonth`, `computeDailyTarget`, `computeMonthlyTarget`:
50 applications per weekday, 0 on weekends, percent clamped to 100). They are
unit-tested, but the dashboard displays the **server's** `monthlyProgress` /
`todayProgress` values as returned.

### Mock data

- In mock mode `MockStudentService` returns a clone of `MOCK_DASHBOARD`
  (`src/features/student/data/mockApplications.ts`): a full-shape sample
  response including `student`, `pages`, and `statistics`. It is a
  representative subset, not a real dataset.
- Live mode never falls back to mock data. A failed request shows an error
  card with Retry.
- Preview tiles (In Review / Interviews / Offers) are marked "Preview" and
  open `ComingSoonDialog`. They never navigate.

## What is **not** implemented (yet)

- Real SMS phone verification and secure phone ↔ Google account linking — see
  `docs/COGNITO_GOOGLE_AUTH.md` (Production readiness).
- A Bearer token on the **dashboard** API. Until that backend validates
  Cognito tokens, live mode sends the signed-in student's `studentId` in the
  dev-only `X-Dev-Student-Id` header and is blocked in production builds.
- Deployment of the account API (`/auth/me`, `/students/register`) — the
  frontend is integrated; the production URL and CORS origin still need to be
  configured.
- Live notifications (no polling / WebSocket / push). Bell navigates to the
  future-release Notifications page.
- Profile editing (Edit opens a coming-soon dialog).
- Real interview, offer, or review tracking (preview placeholders only).
- Cache persistence across reloads (`persistQueryClient` is not used).
- Recruiter and Manager experiences (restricted — not part of this phase).
- Email/password signup, forgot-password, and email OTP (intentionally out of
  scope per spec).

See [`docs/BACKEND.md`](docs/BACKEND.md) for the full list of backend
dependencies and Cognito configuration still required.
