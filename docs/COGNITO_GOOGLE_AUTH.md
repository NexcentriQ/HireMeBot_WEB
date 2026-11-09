# Amazon Cognito Google Sign-In — Integration & Findings

**Status (2026-11-08):** Google sign-in through Amazon Cognito (AWS
Amplify v6) is integrated with the student account API
(`GET /api/v1/auth/me`, `POST /api/v1/students/register`, see
`STUDENT_AUTH_API.md`). Google comes first for everyone; the backend decides
between the dashboard and the signup form. Phone OTP is still a
**development-only simulation**. The backend endpoints are **not deployed**
yet (tested locally against `sam local`); see [§F](#f-production-readiness).

| | |
|---|---|
| Region | `us-east-2` |
| User pool | `us-east-2_F582IgoSY` |
| App client | `5rgjoisv64qhe70oulfla17id9` (public, no secret) |
| Cognito domain | `us-east-2f582igosy.auth.us-east-2.amazoncognito.com` |
| Grant / scopes | Authorization code + PKCE / `openid email` |
| Local callback / sign-out | `http://localhost:5173/auth/callback` / `http://localhost:5173/` |

---

## Contents

- [A. Repository analysis](#a-repository-analysis)
- [Decisions and conflicts resolved](#decisions-and-conflicts-resolved)
- [B. Files changed](#b-files-changed)
- [C. Implemented features](#c-implemented-features)
- [D. Authentication flow](#d-authentication-flow)
- [Error handling](#error-handling)
- [Security notes](#security-notes)
- [E. Test results](#e-test-results)
- [F. Production readiness](#f-production-readiness)
- [Backend integration and account linking](#backend-integration-and-account-linking)
- [G. Commands](#g-commands)
- [Known limitations](#known-limitations)

---

## A. Repository analysis

Findings from inspecting the repository **before** any change.

| # | Area | Finding |
|---|---|---|
| 1 | Versions | React 18.3.1, Vite 5.4.21, TypeScript 5.6, Node 24 used locally |
| 2 | Key dependencies | react-router-dom 6.30, TanStack Query 5, react-hook-form + zod, libphonenumber-js, Radix UI, Tailwind, vite-plugin-pwa. **No AWS SDK / Amplify.** |
| 3 | Routing | React Router v6 `<Routes>` in `src/app/App.tsx`, `BrowserRouter` in `src/main.tsx` |
| 4 | Create Account | `src/features/auth/pages/SignupPage.tsx` (`/signup`) — first/last name, US phone (`+1` pinned), terms checkbox, zod validation |
| 5 | Verify Phone | `src/features/auth/pages/VerifyPhonePage.tsx` (`/verify-phone`) — 6-digit `OtpInput`, Verify, Resend with 60 s countdown (`useResendCountdown`), back link |
| 6 | Google screens | `ConnectGooglePage.tsx` (`/connect-google`, signup step 3) and `LoginPage.tsx` (`/login`, returning users). Both have the existing "Continue with Google" button |
| 7 | Dashboard route | `/student/dashboard` **exists** (`StudentDashboardPage`) under `/student/*` with `StudentLayout`. No discrepancy |
| 8 | Auth services | `AuthService` interface (`types.ts`); `MockAuthService.ts` (live); `CognitoAuthService.ts` (stub — every method threw "not implemented") |
| 9 | API structure | `src/features/student/data/http.ts` (`studentHttpGet`), `studentService.ts` (mock/live switch). Live mode sends a dev-only `X-Dev-Student-Id` header and is refused in production builds |
| 10 | Global state | React Context (`AuthProvider`, `ThemeProvider`, `ToastProvider`) + TanStack Query. **No Redux / Zustand** |
| 11 | Guards | `src/routes/guards.tsx`: `GuestOnly`, `RequireStudent` (checked mock `role === 'STUDENT'` + `activated`), `RequirePendingRegistration`, `RequireActivatedUser` |
| 12 | Env handling | `src/lib/env.ts` lazy, typed `VITE_*` reader. `.env.example` reserved unused Cognito names (`VITE_COGNITO_APP_CLIENT_ID`, `…_REDIRECT_URI`, `…_LOGOUT_URI`, `VITE_COGNITO_REGION`, `VITE_AUTH_PROVIDER`). `.env.local` and `.env.*.local` already git-ignored |
| 13 | Vercel | **No `vercel.json`** and no deployed URL anywhere in the repo. Deep links (e.g. `/auth/callback`) would 404 on a full page load |
| 14 | Tests | Vitest 2 + Testing Library + jsdom. Baseline: **23 files / 121 tests passing**. `npm run lint` is **broken** (ESLint 9 installed, no `eslint.config.*`) |

### Existing authentication behaviour (before)

- **LocalStorage mock sessions.** `MockAuthService` kept the "session" in
  `localStorage` (`hmb.mock.user`, `hmb.mock.pendingRegistration`,
  `hmb.mock.lastResend`). No real authentication, JWTs, Redux, or Zustand.
- **Security problems found:**
  1. The mock OTP `123456` had **no `import.meta.env.DEV` guard**, so it
     worked in production builds.
  2. A successful mock OTP persisted `phoneVerified: true`.
  3. `LoginPage` wrote a hard-coded activated "demo student" into
     localStorage, so **anyone could "log in" on the deployed app** without
     Google.
- The PWA service worker already excludes `/auth/callback` and `/api/*` from
  the navigation fallback and caches (`vite.config.ts`). Kept unchanged.

---

## Decisions and conflicts resolved

| Conflict | Decision |
|---|---|
| Prompt suggests `src/config/cognito.js`, `src/context/AuthContext.jsx`, `src/pages/AuthCallback.jsx` | The repo is TypeScript with feature folders. Used `src/features/auth/…` `.ts/.tsx` and **reused** the existing `AuthProvider` and `AuthCallbackPage` instead of creating duplicates. |
| Token storage: the prompt says let Amplify manage it; `docs/BACKEND.md` says never store JWTs in localStorage | Used Amplify's **supported `sessionStorage` adapter**. It satisfies both rules and survives page refresh. Trade-off: closing the tab or PWA window ends the session (see [Known limitations](#known-limitations)). Switching to Amplify's default (localStorage) is one line in `amplifyConfig.ts`. |
| `Amplify.configure()` resets token storage to localStorage on every call | Token provider is configured first and passed via `libraryOptions.Auth.tokenProvider`, so the OAuth listener writes tokens to `sessionStorage` (verified in Amplify 6.22.2 source). |
| Old mock services | `MockAuthService.ts` and `CognitoAuthService.ts` were **removed**. Their useful parts were refactored: OTP and throttle logic into `mockOtpService.ts`; the session boundary into `authService.ts`. |
| Mock user had `role` / `activated` | Removed. Cognito issues no role claim, so the frontend no longer fabricates one. `RequireStudent` now requires a valid Cognito session and documents the backend integration point. |
| Success page text said "account has been successfully activated" | Changed to "You're signed in with Google and ready to start tracking your applications." No backend activation exists. Layout unchanged. |
| Phone step in production | The OTP form is replaced by an explicit notice ("SMS verification isn't available yet… has not been verified") and a **Continue** button. The draft records `phoneStep: 'deferred'`. Google sign-in stays independently available. |
| Amplify picks the redirect URL by hostname only (ignores the port) | Added an explicit **origin check** before redirecting. `localhost:4173` vs `localhost:5173` now shows an actionable configuration error instead of a broken round trip. |
| `.env.example` variable names | Replaced the reserved, unused names with the requested ones (`VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REDIRECT_URL`, `VITE_COGNITO_SIGNOUT_URL`). Removed `VITE_COGNITO_REGION` (Amplify derives the region from the pool ID) and `VITE_AUTH_PROVIDER`. |
| `/student/profile` identity | Unchanged: identity is still shown only from the backend `data.student` payload, never from the auth session. |

---

## B. Files changed

**Created**

| File | Purpose |
|---|---|
| `src/features/auth/amplifyConfig.ts` | `buildAmplifyConfig()` + `initializeAuth()`: one-time Amplify v6 configuration, sessionStorage tokens, OAuth listener, legacy mock-storage purge |
| `src/features/auth/services/authService.ts` | `loginWithGoogle`, `getAuthenticatedUser`, `getAuthSession`, `getAccessToken`, `getIdToken`, `isAuthenticated`, `logout`, `completeRedirectSignIn`, claim mapping |
| `src/features/auth/services/authErrors.ts` | Maps Amplify/OAuth/network errors to user-safe messages; DEV-only diagnostics (names only) |
| `src/features/auth/services/redirectOutcome.ts` | Records Amplify Hub `signInWithRedirect` / `_failure` events from startup so the callback can't miss them |
| `src/features/auth/services/redirectIntent.ts` | Remembers flow (`login`/`signup`) + validated return path across the OAuth redirect |
| `src/features/auth/services/onboardingDraft.ts` | Short-lived Create Account draft (sessionStorage, 30-min TTL) |
| `src/features/auth/services/phoneVerification.ts` | `PhoneVerificationService` selection: DEV mock vs production "unavailable" |
| `src/features/auth/services/mockOtpService.ts` | Development-only OTP simulation (`123456`) |
| ~~`src/features/auth/services/studentOnboardingApi.ts`~~ | Removed 2026-11-08: replaced by `studentAccountApi.ts` (real `GET /auth/me` + `POST /students/register`) |
| `src/features/auth/hooks/useGoogleSignIn.ts` | Shared Google button logic: double-click guard, bfcache reset, already-signed-in handling |
| `src/test/fakeAmplifyAuth.ts` | In-memory `aws-amplify/auth` fake used by all tests |
| `src/features/auth/__tests__/{authService,amplifyConfig,mockOtpService,onboardingDraft,AuthProvider,AuthCallbackPage,signupFlow}.test.*` | New tests (see §E) |
| `vercel.json` | SPA rewrite to `index.html` |
| `docs/COGNITO_GOOGLE_AUTH.md` | This document |

**Modified**

| File | Change |
|---|---|
| `src/main.tsx` | Calls `initializeAuth()` once before rendering |
| `src/features/auth/AuthProvider.tsx` | Cognito-backed state `{ user, isAuthenticated, isLoading, error }`, `loginWithGoogle`, `logout`, `refresh`. Hub sync, expiry re-check on tab focus |
| `src/features/auth/types.ts` | `AuthUser` (Cognito `sub` based), error codes, `PhoneVerificationService` interface |
| `src/features/auth/pages/SignupPage.tsx` | Writes the onboarding draft (no Cognito call), prefills when the user returns. **Markup unchanged** |
| `src/features/auth/pages/VerifyPhonePage.tsx` | Uses `PhoneVerificationService`. Same OTP UI, countdown, and back link. Production "deferred" state |
| `src/features/auth/pages/ConnectGooglePage.tsx` | Existing button now calls real Cognito sign-in |
| `src/features/auth/pages/LoginPage.tsx` | Fake demo-user login **removed**. Real Cognito sign-in preserving the requested page |
| `src/features/auth/pages/AuthCallbackPage.tsx` | Real OAuth completion, StrictMode-safe single redirect, error UI reused |
| ~~`src/features/auth/pages/SignupSuccessPage.tsx`~~ | Removed 2026-11-08: registration now lands directly on the dashboard |
| `src/routes/guards.tsx` | Cognito-session guards. `RequireActivatedUser` renamed to `RequireAuthenticatedUser`. `needsPhoneVerified` renamed to `needsPhoneStep` |
| `src/app/App.tsx` | Guard renames only. No routes added or removed |
| `src/lib/env.ts` | `cognitoEnv()` / `missingCognitoEnv()` |
| `src/test/setup.ts` | Global Amplify fake, Cognito env stubs, `ResizeObserver` polyfill, sessionStorage reset |
| `src/test/dashboardFixtures.ts`, `src/features/student/__tests__/{navigation,StudentDashboardPage,StudentDashboardPage.refetchError}.test.tsx`, `src/routes/__tests__/guards.test.tsx` | Seed the fake Cognito session instead of `hmb.mock.user` |
| `package.json`, `package-lock.json` | `aws-amplify@^6.22.2` |
| `.env.example` | Cognito placeholders + guidance |
| `.env.local` *(git-ignored, not committed)* | Appended the five `VITE_COGNITO_*` values. Existing variables untouched |
| `README.md`, `docs/BACKEND.md`, `docs/API_AND_CACHING.md` | Removed statements that auth is a mock; link here |

**Deleted:** `src/features/auth/services/MockAuthService.ts`,
`src/features/auth/services/CognitoAuthService.ts`,
`src/features/auth/__tests__/MockAuthService.test.ts`.

**Untouched:** recruiter (none exist in this repo), student dashboard
/ applications / profile / notifications pages, `http.ts` / student API,
styling, PWA configuration, Java backend, MySQL schema.

---

## C. Implemented features

**Fully implemented**

- Real Google sign-in via Cognito (Authorization Code + PKCE) from the
  existing Login and Continue with Google buttons
- OAuth callback handling at `/auth/callback`
- Session restore on startup and refresh
- Expiry handling: `tokenRefresh_failure` and a re-check when the tab regains focus
- Protected `/student/*` routes, return to the originally requested page
- Cognito sign-out from the existing profile "Sign out" button
- User-safe error handling
- Vercel SPA rewrite

**Development-only**

- Mock OTP `123456`, resend throttle, dev hint. Requires `import.meta.env.DEV`;
  every method re-checks it, and production bundles do not contain it
  (verified, §E)

**Deferred (not implemented, by decision)**

- Real SMS OTP (Cognito SMS / Twilio / paid services / SMS sender registration)
- Backend student onboarding/profile persistence and role checks
- Phone-to-Google account linking
- Production Cognito callback/sign-out URLs (the production URL is unknown)
- AWS infrastructure changes of any kind

---

## D. Authentication flow

One **Continue with Google** button serves new and returning students
(`/login`; the "Sign Up" link starts the same flow).

```text
Continue with Google (/login)
  └─ redirect intent {flow, returnTo} → signInWithRedirect({provider:'Google'})
        ↓
Cognito Hosted UI → Google → Cognito /oauth2/idpresponse
        ↓
/auth/callback?code=…   Amplify exchanges code + PKCE verifier for tokens
        ↓
GET /api/v1/auth/me     Authorization: Bearer <Cognito ACCESS token>
  ├─ DASHBOARD        → saved /student/* page or /student/dashboard   (draft cleared)
  ├─ ACCOUNT_PENDING  → /account-status "Account pending"             (draft cleared)
  ├─ SIGNUP_FORM      → /signup (draft restored only for the same Google sub)
  │                       ↓ validates names, US phone, Terms → draft in sessionStorage
  │                     /verify-phone
  │                       DEV : mock OTP 123456 (verifies nothing)
  │                       PROD: "SMS verification isn't available yet" → Continue
  │                       ↓
  │                     POST /api/v1/students/register  {firstName,lastName,phoneNumber,acceptedTerms}
  │                       ├─ 201 data.nextStep → dashboard / pending   (draft cleared)
  │                       ├─ 400 VALIDATION_FAILED, 409 NAME_ALREADY_REGISTERED → back to /signup, messages on fields
  │                       ├─ 409 ACCOUNT_ALREADY_REGISTERED → re-run GET /auth/me, follow it
  │                       ├─ 403 / 409 ACCOUNT_IDENTITY_CONFLICT → /account-status (draft cleared)
  │                       ├─ 401 → sign out locally, draft kept → /connect-google
  │                       └─ 5xx / network → inline error + requestId + "Try again"
  ├─ 403 / 409        → /account-status restricted screen (never the form)
  ├─ 401              → sign out locally → Continue with Google (draft kept)
  └─ 5xx / network    → /account-status "We couldn't load your account" + Try again
```

**Account state.** `AuthProvider` holds the Cognito identity *and* the
backend answer (`account.status`: `none | active | pending | unregistered |
restricted | error`), in memory only. `GET /auth/me` runs on every app start
and every Google sign-in (Hub `signedIn` / `signInWithRedirect`), and again
in the background when the tab becomes visible, so suspensions take effect
without trusting any stored flag. `routeForAccount()` in
`src/features/auth/account.ts` is the single routing rule used by the
callback, all guards, and the registration step.

**Guards** (`src/routes/guards.tsx`): `/student/*` requires `active`;
`/signup` requires `unregistered`; `/verify-phone` additionally requires a
draft written by the same Cognito `sub`; `/account-status` covers
`pending | restricted | error`; `/connect-google` is the "session ended,
continue with Google to finish" screen for a signed-out user with a draft.

**Requests** (`src/features/auth/services/studentAccountApi.ts`): the access
token is read with `fetchAuthSession()` right before every attempt (never
cached); `credentials: 'omit'`, `cache: 'no-store'`; 503 retried with 1 s /
2 s / 4 s backoff; network failures retried for the lookup only; API Gateway
401/403 bodies without `code` are treated as `UNAUTHORIZED`. Registration is
sent once: the button is disabled in flight and concurrent calls share one
promise (a duplicate would only return 409 `ACCOUNT_ALREADY_REGISTERED`).

**Draft** (`onboardingDraft.ts`): names, E.164 phone, Terms, UI phone step,
and the owning Cognito `sub`. sessionStorage, 30-min TTL. Cleared on
success, conflict, restriction and sign-out; kept on `UNAUTHORIZED`;
discarded when a different Google account comes back.

**Callback robustness.** Amplify starts the code exchange from a module-level
listener as soon as it is configured, often before React mounts the page.
The callback page handles every ordering:

1. `getAuthenticatedUser()` is **parked by Amplify** until an in-flight
   exchange settles, so an error is never shown mid-exchange.
2. Hub outcomes are recorded from before `Amplify.configure()`
   (`redirectOutcome.ts`), so an early `signInWithRedirect_failure` is not lost.
3. `?error=` params (which Amplify leaves in the URL on failure) are read
   directly.
4. An already-established session succeeds immediately.
5. React StrictMode: the work runs once and navigates exactly once (tested).

**Logout.** Profile → Sign out → app state, onboarding draft, redirect
intent, and student-dashboard cache are cleared → Amplify `signOut()`
clears tokens and revokes the refresh token → browser goes to Cognito
`/logout` → returns to `VITE_COGNITO_SIGNOUT_URL` (`/` → `/login`).

---

## Error handling

| Scenario | Behaviour |
|---|---|
| User cancels at Google | If Cognito returns an error to the callback (typically `access_denied`) the page shows "Google sign-in was cancelled…" with **Try again** (back to Continue with Google or Login). If the user just presses Back, the page restored from bfcache re-enables the button and Amplify clears the in-flight flow |
| Google/Cognito OAuth failure | "Google sign-in didn't complete… your Google account may not be allowed to use HireMeBot yet." DEV builds append the OAuth error code |
| Not an allowed Google test user | Google blocks the account on its own page. If the user is returned with an error, they see the message above. Pressing Back resets the button (bfcache handler) |
| Callback URL mismatch | Detected **before** redirecting when the app origin isn't in `VITE_COGNITO_REDIRECT_URL`. DEV shows the expected vs actual origin and what to change. A URL that is missing in Cognito itself shows Cognito's own `redirect_mismatch` page (it never returns to the app) — see §F checklist |
| Missing env config | App still renders. Sign-in shows "Sign-in isn't available right now" (DEV: lists missing variable names). Console lists names only |
| Network failure | "We couldn't reach the sign-in service…". The button re-enables for retry. A failed token exchange maps to the same retryable error |
| Session expires | Amplify refreshes silently. If refresh fails, the user is cleared and guards redirect to `/login` with the return path. Re-checked when the tab regains focus |
| Refresh on dashboard | Session restored from Amplify. A splash screen shows until the check finishes (no protected-page flash, no redirect loop) |
| Logout | State cleared even if the Cognito call fails. The error is recorded |
| Mock OTP incorrect / incomplete | "Incorrect code" / "Enter the 6-digit code". Verify stays disabled under 6 digits |
| Mock OTP in production | Not rendered. Service rejects with `PHONE_VERIFICATION_UNAVAILABLE`. Code not in the bundle |
| Duplicate Google clicks | Ref guard + disabled/loading button → exactly one `signInWithRedirect` |
| Already signed in | `UserAlreadyAuthenticatedException` → resume (success page or dashboard) |

---

## Security notes

- **No secrets in the frontend.** The Google client secret exists only in the
  Cognito Google IdP configuration. The app client is public. A bundle scan
  found no `client_secret` / `clientSecret`.
- **Tokens:** never copied into React state, Web Storage, or logs by app
  code. Amplify stores them via its sessionStorage adapter. `getAccessToken()`
  / `getIdToken()` exist for future API calls. Tests assert tokens never
  reach the DOM or the user object.
- **Claims are display-only.** Amplify decodes the ID token it received from
  Cognito over TLS but does not verify signatures. The backend must verify
  JWTs and authorize every request.
- **Identity key:** Cognito `sub` (`AuthUser.userId`). Email is never used as
  an account-linking key.
- **Open-redirect protection:** return paths must start with `/student`, and
  `//`, `..`, backslashes, whitespace, and absolute URLs are rejected.
- **Mock OTP:** guarded by `import.meta.env.DEV` at selection *and* in every
  method. Its result is `dev-simulated`. No `phone_verified=true` is written
  anywhere. Legacy `hmb.mock.*` keys (including the old fake
  `phoneVerified: true` record and the fake session) are purged at startup.
- **Onboarding draft:** sessionStorage + TTL, no tokens or identifiers. The
  request builder never includes `phoneStep`.
- **No privileged Cognito APIs in the browser** (no `AdminLinkProviderForUser`,
  no `signUp()` for SMS).

---

## E. Test results

Run on 2026-11-06 (Windows, Node 24.13.1).

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | ✅ pass |
| `npm test` (Vitest) | ✅ **29 files, 212 tests passing** (baseline 23 / 121; 4 obsolete mock tests removed) |
| `npm run build` | ✅ pass. Bundle 674 KB / 200.5 KB gzip (before: 587 KB / 172.5 KB). Amplify auth adds about +87 KB / +28 KB gzip. Vite's ">500 KB chunk" warning **already existed** before this change |
| `npm run lint` | ❌ **pre-existing failure:** no `eslint.config.*` exists for ESLint 9. Not fixed here (it needs new dev dependencies and rules unrelated to this task) |
| Production bundle scan | ✅ No mock OTP messages, dev hint, or `INVALID_OTP_FORMAT`. The three `123456` matches are Amplify's PKCE alphabet (×2) and mock job data. Only `hmb.mock.user` is the purge routine |
| `npm audit --omit=dev` | 3 **pre-existing** findings (react-router, zod). None from `aws-amplify`. Not upgraded (breaking majors, out of scope) |

**New automated coverage** (against an in-memory Amplify fake):

- **Signup form:** fields, invalid phone, terms required, missing name
  blocked, valid submit → OTP screen, no Cognito call, prefill on return
- **Mock OTP:** correct code, incorrect code, five malformed/incomplete
  codes, resend throttle, production rejection, `dev-simulated` (never
  "verified"), production build shows no OTP form or code
- **Google:** single `signInWithRedirect({provider:'Google'})` under repeated
  clicks, start-up errors re-enable the button, already-signed-in resume,
  callback-origin mismatch error, return path preserved
- **Callback:** routing on every `nextStep` and error class, draft keep/clear/ownership, return path, StrictMode
  single redirect, no premature error during the exchange, cancellation,
  rejected account, network failure, no sign-in in progress, no token leakage
- **Provider and guards:** session restore, loading gate, unauthenticated
  redirect with return path, network failure treated as signed out, logout
  clears state/draft/intent, logout tolerates failure, `tokenRefresh_failure`,
  Hub sign-in/sign-out, phone-step gating
- **Config:** exact Amplify v6 config shape, configure-once, sessionStorage
  token provider, missing-env handling with names-only logging, no secret in config

**Live checks against your Cognito domain** (no credentials needed — the same
requests a browser sends):

| Request | Result |
|---|---|
| `/oauth2/authorize` with this app's client ID, callback, `identity_provider=Google`, `openid email`, PKCE | ✅ 302 to `accounts.google.com`. Callback registered, Google enabled for this client, scopes accepted. Cognito asks Google for `openid email profile` |
| Same with an unregistered callback (`localhost:4173`) | Cognito `/error?error=redirect_mismatch` (confirms mismatches never return to the app) |
| `/logout?logout_uri=http://localhost:5173/` | ✅ 302 to `http://localhost:5173/`. Sign-out URL registered |
| `npm run dev` smoke | ✅ `/auth/callback?code=…` and `/student/dashboard` serve the app. Amplify modules resolve. `.env.local` values injected |

**Not tested here:** a full interactive Google login. No browser or Google
account was available, so **end-to-end OAuth success has not been
verified.** Run the manual checklist below.

### Manual test checklist

Run `npm run dev` and use **http://localhost:5173** (not `127.0.0.1`, not
`:4173`).

1. **Signup:** `/signup` → fill in the form → Continue → `/verify-phone`
   shows "Dev-only mock".
2. **OTP:** enter `000000` → error shown. Enter `123456` → Continue with Google.
3. **Google:** click → the browser goes to Google (not a Cognito-hosted form)
   → choose an allowed test account → returns to `/auth/callback` → "Account
   Created!" → Go to Dashboard.
4. **Refresh** `/student/dashboard` → still signed in.
5. **New tab** → `/student/dashboard` → sent to `/login` (expected with
   sessionStorage). Continue with Google → back on the dashboard.
6. **Return path:** signed out, open `/student/applications` → `/login` →
   Google → lands on `/student/applications`.
7. **Cancel:** start Google, then cancel/back out at Google → you return to
   the app with a cancellation message or a re-enabled button.
8. **Non-test user** (if the Google app is in Testing mode): Google blocks
   the account. Confirm the app recovers.
9. **Logout:** Profile → Sign out → Cognito logout → `/login`. Opening
   `/student/dashboard` redirects to login. Signing in again works.
10. **DevTools → Application:** tokens are only under sessionStorage
    `CognitoIdentityServiceProvider.*`. No tokens in the console. Draft key
    `hmb.onboarding.draft` holds no tokens.
11. **Production preview of the phone step:** `npm run build && npx vite
    preview --port 5173 --strictPort` → `/signup` → the phone step shows "SMS
    verification isn't available yet", with no OTP inputs.
12. **Regression:** dashboard, applications, details, profile, notifications,
    theme toggle, and mobile layout look and behave as before.

---

## F. Production readiness

**Do not describe the three-step signup as production-ready.** Blockers:

| Blocker | Owner | Notes |
|---|---|---|
| Real SMS OTP verification | Backend/AWS | Requires the AWS paid plan (End User Messaging SMS) or another provider. The frontend seam is `getPhoneVerificationService()` |
| Secure phone ↔ Google account linking | Backend | Server-side only, after real verification. See below |
| Deploy the account API | Backend | `GET /api/v1/auth/me` and `POST /api/v1/students/register` are integrated but not deployed. Set `VITE_ACCOUNT_LOOKUP_URL` / `VITE_STUDENT_REGISTRATION_URL` (stack outputs) or `VITE_API_BASE_URL`, and add the production origin to the backend CORS `PortalOrigin` |
| Server-side authorization | Backend | Verify Cognito JWTs (API Gateway Cognito authorizer or a JWT check in Lambda). Enforce STUDENT role and ownership. Replace `X-Dev-Student-Id` |
| Production callback / sign-out URLs | You (AWS console + Vercel) | The production URL isn't in the repo. Nothing was registered or assumed |
| Google OAuth consent screen | You (Google Cloud) | In **Testing** mode only listed test users can sign in. Publish the app for general use |

### Before the first production deployment

1. **Cognito → User pool → App client `5rgjoisv64qhe70oulfla17id9` → Login pages:**
   - Allowed callback URLs: add `https://<your-vercel-domain>/auth/callback`
   - Allowed sign-out URLs: add `https://<your-vercel-domain>/`
   - Keep the localhost entries for development. URLs must match **exactly**
     (scheme, host, port, path, trailing slash).
2. **Vercel → Project → Settings → Environment Variables (Production):**

   | Variable | Value |
   |---|---|
   | `VITE_COGNITO_USER_POOL_ID` | `us-east-2_F582IgoSY` |
   | `VITE_COGNITO_CLIENT_ID` | `5rgjoisv64qhe70oulfla17id9` |
   | `VITE_COGNITO_DOMAIN` | `us-east-2f582igosy.auth.us-east-2.amazoncognito.com` |
   | `VITE_COGNITO_REDIRECT_URL` | `https://<your-vercel-domain>/auth/callback` |
   | `VITE_COGNITO_SIGNOUT_URL` | `https://<your-vercel-domain>/` |
   | `VITE_ACCOUNT_LOOKUP_URL` | stack output `AccountLookupUrl` (or set `VITE_API_BASE_URL`) |
   | `VITE_STUDENT_REGISTRATION_URL` | stack output `StudentRegistrationUrl` |
   | `VITE_STUDENT_API_MODE` | optional — defaults to `mock` (live mode is refused in production builds) |

   `VITE_*` values are embedded at **build time**, so redeploy after
   changing them. Vercel **preview** deployments use per-deployment URLs.
   Either register a stable preview domain in Cognito or expect sign-in to
   fail there with the mismatch message. Comma-separated
   `VITE_COGNITO_REDIRECT_URL` values are supported.
3. **Routing:** `vercel.json` rewrites all paths to `index.html`, so
   `/auth/callback` and `/student/*` survive full reloads. Static assets
   (`/assets`, `/sw.js`, icons) are served first by Vercel's filesystem
   precedence.
4. **Local production builds** read `.env.local`, so they embed the
   localhost callback. That is fine for `vite preview --port 5173`, wrong for
   deployment. Vercel builds don't see `.env.local`.

---

## Backend integration and account linking

**Implemented** against `STUDENT_AUTH_API.md` (2026-11-07 contract):

| Endpoint | Frontend |
|---|---|
| `GET /api/v1/auth/me` | `lookupAccount()` → `AuthProvider.refresh()` |
| `POST /api/v1/students/register` | `registerStudent()` → `AuthProvider.registerStudent()` → `VerifyPhonePage` |

Local: `sam local start-api --env-vars env.json` on `http://127.0.0.1:3000`
with `VITE_API_BASE_URL=http://127.0.0.1:3000` (the backend allows the CORS
origin `http://localhost:5173`), or leave it empty to go through the Vite
`/api` proxy.

Still open:

- The student **dashboard** API (`src/features/student/data/http.ts`) still
  uses the dev-only `X-Dev-Student-Id` header in live mode. Switch it to
  `Authorization: Bearer ${await getAccessToken()}` once that API validates
  Cognito tokens. Its error envelope uses `error`, not `code`.
- Phone ownership is not verified (mock / deferred). The backend stores the
  phone as unverified; the frontend never sends OTP values or a verified flag.

**Account linking rules (future, server-side only).** Two real verified
identities don't exist yet (the phone is simulated or deferred), so nothing
is linked today. When real phone verification exists:

1. The backend verifies phone ownership itself (OTP issued and checked
   server-side).
2. The backend associates the verified phone with the Cognito `sub` from a
   verified token. If two Cognito users must be merged,
   `AdminLinkProviderForUser` runs **server-side** with IAM credentials,
   never from React.
3. Never link on email alone or on an unverified phone number.

---

## G. Commands

```bash
# Install dependencies (aws-amplify is already in package.json)
npm install

# Configure local env (already done in this checkout's .env.local)
cp .env.example .env.local      # then set the VITE_COGNITO_* values

# Start the app — must be http://localhost:5173 for the Cognito callback
npm run dev

# Run tests
npm test                # once
npm run test:watch      # watch mode
npm run typecheck

# Production build (+ local preview on the registered port)
npm run build
npx vite preview --port 5173 --strictPort
```

---

## Known limitations

- **Session lifetime:** sessionStorage means each new tab, browser restart,
  or PWA relaunch needs one "Continue with Google" click. To persist
  sessions, remove `setKeyValueStorage(sessionStorage)` in
  `amplifyConfig.ts`; Amplify then uses localStorage (XSS-readable, contrary
  to the current project rule). The robust option is HttpOnly cookies via a
  backend-for-frontend.
- **Installed iOS PWA:** OAuth redirects out of a standalone PWA can open in
  an in-app browser context with separate storage. Test on a device before
  relying on installed-PWA sign-in.
- **Port must match:** use `localhost:5173`. Other ports and `127.0.0.1`
  show the configuration error.
- **`given_name` / `family_name`:** only present if Cognito attribute
  mapping provides them (Cognito asks Google for `profile`). The app treats
  them as optional. `fetchUserAttributes()` is not used because it needs the
  `aws.cognito.signin.user.admin` scope, which this client doesn't request.
- **Lint:** `npm run lint` fails until an ESLint 9 flat config is added (pre-existing).
- **Bundle size:** the single chunk was already over 500 KB. Consider
  code-splitting the student pages separately.
