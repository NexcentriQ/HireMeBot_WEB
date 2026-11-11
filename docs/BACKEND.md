# Backend & Cognito dependencies

> **Status (2026-11-11):** Google sign-in through Amazon Cognito is
> implemented in the frontend with AWS Amplify v6 (Authorization Code + PKCE,
> public app client). The frontend is integrated with the student account API
> (`GET /api/v1/auth/me`, `POST /api/v1/students/register`) and the student
> dashboard API (`GET /api/v1/student/applications`). `MockAuthService`,
> `CognitoAuthService` and the earlier proposed `GET /students/me` /
> `POST /students/onboarding` contracts no longer exist. The
> registration/OTP endpoints in the last sections are the **deferred**
> reference design for server-side phone verification; the current frontend
> does not call them.
>
> The account API is integrated but **not deployed**; it has been tested
> locally with `sam local`. See [`COGNITO_GOOGLE_AUTH.md`](COGNITO_GOOGLE_AUTH.md)
> for the flow and the production checklist.

This document captures what the real backend and the Cognito User Pool must
provide, and where the integration seams live in the frontend code.

## Amazon Cognito User Pool

| Setting                | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| User pool type         | Standard, with Google as a federated identity provider  |
| App client             | **Public** (no client secret) — PWA cannot keep secrets |
| Auth flows             | OAuth 2.0 Authorization Code + PKCE                     |
| Hosted UI domain       | e.g. `<prefix>.auth.us-east-2.amazoncognito.com`        |
| Allowed callback URL   | `https://<app>/auth/callback` (and `http://localhost:5173/auth/callback` for development) |
| Allowed sign-out URL   | `https://<app>/` (and `http://localhost:5173/`)         |
| App client scopes      | `openid email` — must match `COGNITO_OAUTH_SCOPES` in `src/features/auth/amplifyConfig.ts` |
| Identity provider      | Google (OIDC with verified email claim required)        |
| Attribute mapping      | Map Google `sub` → Cognito `sub`; `email` → `email`; `given_name` / `family_name` if available (Cognito asks Google for `openid email profile`) |

Notes:

- Email **must** come from Google and the backend must independently check
  the `email_verified` claim before trusting it.
- Use the Cognito stable `sub` as the identity reference everywhere — never
  the email string.
- A browser-based PWA uses a public app client without a client secret. If
  the team adopts a backend-for-frontend session architecture (HttpOnly
  cookies instead of browser tokens), replace the Amplify session code in
  `src/features/auth/services/authService.ts` with calls to that BFF — no
  token storage in JavaScript.
- Tokens are stored by Amplify in `sessionStorage`, never copied into app
  state; see "Dashboard identity and where state lives" in
  [`COGNITO_GOOGLE_AUTH.md`](COGNITO_GOOGLE_AUTH.md).

## Endpoints the frontend uses today

Base URL: `VITE_API_BASE_URL` (empty → same-origin `/api`, which the Vite dev
proxy forwards to `VITE_API_PROXY_TARGET`, default `http://127.0.0.1:3000`).
The two account endpoints can also be set individually with
`VITE_ACCOUNT_LOOKUP_URL` / `VITE_STUDENT_REGISTRATION_URL` (deployed stack
outputs `AccountLookupUrl` / `StudentRegistrationUrl`). For deployed
environments, the backend CORS configuration must allow the app's origin
(`PortalOrigin`).

### `GET /api/v1/auth/me` — account lookup

Client: `lookupAccount()` in `src/features/auth/services/studentAccountApi.ts`,
called by `AuthProvider.refresh()` on app start, on every Google sign-in, and
when a signed-in tab becomes visible again. It never creates an account.

- Auth: `Authorization: Bearer <Cognito ACCESS token>`, read from Amplify right
  before every attempt. Identity comes only from the token; no email, `sub` or
  "verified" flag is ever sent.
- Responses the client accepts (anything else is `INVALID_RESPONSE`):

  | Body | Meaning | Frontend `account.status` / route |
  |---|---|---|
  | `{ success: true, registered: true, nextStep: 'DASHBOARD', user }` | Registered, active student | `active` → `/student/*` |
  | `{ success: true, registered: true, nextStep: 'ACCOUNT_PENDING', user }` | Registered, pending | `pending` → `/account-status` |
  | `{ success: true, registered: false, nextStep: 'SIGNUP_FORM', message? }` | Google identity, not a student yet | `unregistered` → `/signup` |

- `user` is validated as `{ userId: number, studentId: number, firstName,
  lastName, email, phoneNumber, emailVerified, phoneVerified, accountStatus,
  accountType }`. `userId` must be a number or the response is rejected.
  **`studentId` is what the dashboard request uses** (see below), so the
  backend must return it for every registered student.
- Network failures and 503s are retried (1 s / 2 s / 4 s for 503).

### `POST /api/v1/students/register` — student registration

Client: `registerStudent()`, called by `AuthProvider.registerStudent()` from
`VerifyPhonePage`, only after a lookup answered `SIGNUP_FORM`.

- Auth: same Bearer access token.
- Body (exactly these four fields): `{ firstName, lastName, phoneNumber
  (E.164, e.g. +17135550101), acceptedTerms: true }`. No OTP value and no
  "phone verified" flag are ever sent; the backend stores the phone as
  unverified.
- Success: `{ success: true, data: { nextStep: 'DASHBOARD' | 'ACCOUNT_PENDING',
  userId, studentId, firstName, lastName, email, phoneNumber, emailVerified,
  phoneVerified, accountStatus, accountType } }`. The frontend stores the
  student in `account.student` and goes straight to the dashboard (or
  `/account-status`).
- A 503 is retried with backoff; network failures are **not** retried
  automatically (the UI offers "Try again"). Retrying is safe: a duplicate
  answers `409 ACCOUNT_ALREADY_REGISTERED` and creates nothing.

### Error contract for the account endpoints

Errors use `{ success: false, code, message, requestId, fieldErrors? }`;
the client branches on `code` (not `error`). `fieldErrors` is an array of
`{ field, message }`; the frontend maps `firstName`, `lastName`,
`phoneNumber` and `acceptedTerms` onto the signup form. API Gateway 401/403
bodies without a `code` are treated as `UNAUTHORIZED`. An unknown or missing
code is classified by status (401 → `UNAUTHORIZED`, 503 → `SERVICE_UNAVAILABLE`,
5xx → `INTERNAL_ERROR`, otherwise `INVALID_RESPONSE`).

| Code | Frontend behaviour |
|---|---|
| `UNAUTHORIZED` (and client-side `NO_SESSION`) | Sign out locally, keep the signup draft, send to Continue with Google (`/connect-google` if a draft exists, else `/login`) |
| `ACCOUNT_SUSPENDED`, `ACCOUNT_DELETED`, `ACCOUNT_TYPE_MISMATCH`, `GOOGLE_ACCOUNT_REQUIRED`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_IDENTITY_CONFLICT` | "Restricted" account screen; never the signup form; draft cleared |
| `ACCOUNT_ALREADY_REGISTERED` | Re-run `GET /auth/me` and follow it |
| `NAME_ALREADY_REGISTERED`, `VALIDATION_FAILED` | Back to `/signup` with messages on the matching fields |
| `INVALID_REQUEST`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` | Generic "try again" message |
| `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`, client-side `NETWORK` / `INVALID_RESPONSE` | Retryable: inline error with `requestId` and "Try again" (`/account-status` for a failed lookup) |

### `GET /api/v1/student/applications` — student dashboard

Client: `LiveStudentService.getDashboard()` →
`studentHttpGet()` (`src/features/student/data/http.ts`), used only when
`VITE_STUDENT_API_MODE=live`. One response feeds every student page (stats,
applications, and the `student` profile object). Caching is described in
[`API_AND_CACHING.md`](API_AND_CACHING.md).

- No query parameters (the backend rejects `date`, `page`, `size`, `week`,
  `month`).
- **Auth today (development only):** the header
  `X-Dev-Student-Id: <studentId>`, where `studentId` is the signed-in
  student's id returned by `GET /auth/me` / registration
  (`account.student.studentId`). It is not read from the environment. Because
  that header is not authentication, live mode is refused in production
  builds (build-time check in `vite.config.ts` and runtime check in
  `src/lib/env.ts`).
- **Auth target:** `Authorization: Bearer <Cognito ACCESS token>`, with the
  backend deriving the student from the verified token. The frontend change is
  confined to `studentHttpGet`; the backend should ignore any client-supplied
  student id once it validates tokens.
- Success: `{ success: true, data: DashboardResponse }` (see
  `src/features/student/data/apiTypes.ts`): `studentId`, `date`, `student`
  (`firstName`, `lastName`, `email`, `phoneE164 | null`, `phoneVerified`),
  `totalApplications`, `pageSize`, `totalPages`, `pages` (keyed by page
  number), and `statistics` (timezone, monthly/today progress, weekly
  activity).
- Errors use a **different** envelope from the account API:
  `{ success: false, error, message, details? }` (branch on `error`, e.g.
  `BAD_REQUEST`, `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`,
  `SERVICE_UNAVAILABLE`). The frontend shows an error card with Retry and
  never falls back to mock data in live mode.

## Security requirements

- OTP generation, expiry, resend limits, attempt limits and single-use
  invalidation live on the backend. The frontend's 60-second countdown is a
  UX convenience only.
- Verify Cognito JWTs on every protected API (API Gateway Cognito authorizer
  or a JWT check in Lambda). Amplify decodes claims in the browser without
  verifying signatures, so the frontend's guards are UX, not security.
- Authorize by the identity in the verified token. Never trust a student id,
  `registrationId` or other identifier supplied by the client.
- Reject any Google identity whose `email_verified` claim is not `true`.
- Role authorization lives server-side. The frontend does not fabricate a
  role; `account.status` only decides which screen to show.
- Public signup must only ever create `STUDENT` users. Recruiter/Manager
  provisioning is out-of-band.
- Never store JWTs or refresh tokens in `localStorage` or the service worker
  cache (the app uses Amplify's `sessionStorage` adapter; the service worker
  never caches `/api/*`). Prefer HttpOnly + Secure + SameSite=Lax cookies via
  a BFF.

## Deferred: server-side phone verification & account linking (reference design)

Not used by the current frontend. Today the phone step is a development-only
mock (`123456`) or, in production builds, a notice that SMS verification is
unavailable, and the backend stores the phone as unverified. When real
verification is added, the capabilities below are needed. Shapes may evolve
during API design — the point is which capabilities exist.

### `POST /auth/registrations`

Starts a pending student registration.

- Body: `{ firstName, lastName, phoneE164 }`
- Response: `{ registrationId }`
- Must enforce: name validation, E.164 phone validation, rate limiting per IP
  and per phone, duplicate-registration throttling.

### `POST /auth/registrations/{id}/otp:send`

Sends (or re-sends) an SMS OTP for a pending registration.

- Response: `{ nextResendInSeconds }`
- Must enforce: server-side resend throttle (do not trust the UI's 60s
  countdown), OTP code generation, expiry window, delivery via SNS/Pinpoint.

### `POST /auth/registrations/{id}/otp:verify`

Verifies an OTP for a pending registration.

- Body: `{ code }`
- Response: `{ phoneVerified: true }`
- Must enforce: attempt limits, expiry, lockout, single-use codes.

### `POST /auth/registrations/{id}/google:start`

Returns the Cognito hosted-UI authorize URL for Google federation and binds a
server-side nonce to the pending registration so the callback cannot be
hijacked.

- Response: `{ redirectUrl }`
- Must enforce: registration must have `phoneVerified = true`; nonce stored
  server-side keyed to registration.

### `POST /auth/callback`

Exchanges the Cognito authorization code for tokens (ideally server-side via
a BFF), reads the Google `email_verified` claim, and binds the Cognito `sub`
to the pending registration.

- Must enforce: PKCE verifier match, Google `email_verified = true`, that no
  other activated account already owns this `sub` (reject with
  `ACCOUNT_CONFLICT` otherwise).

### `POST /auth/registrations/{id}/activate`

Finalizes account activation: creates the `STUDENT` row in MySQL, deletes
the pending registration, and returns the activated student.

### Notes

- `GET /auth/me` and `POST /auth/logout` from the earlier design are
  superseded: lookup is `GET /api/v1/auth/me` (above) and sign-out is
  Cognito's `signOut()` followed by the hosted `/logout` redirect.
- The `registrationId` returned to the browser must be an opaque token with
  no privileges beyond "may call OTP + activation endpoints for this
  registration until it expires." The server binds it to the Cognito `sub`
  via the signed-in callback — never trust an `?id=` URL parameter.
- If two Cognito users must be merged, `AdminLinkProviderForUser` runs
  **server-side** with IAM credentials, never from React. Never link on email
  alone or on an unverified phone number.

## Frontend configuration and switch-over

Set the `VITE_*` variables in `.env.local` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_REDIRECT_URL`, `VITE_COGNITO_SIGNOUT_URL` | Cognito / Amplify (public values only) |
| `VITE_API_BASE_URL` | Backend base URL (empty → same-origin `/api` via the dev proxy) |
| `VITE_ACCOUNT_LOOKUP_URL`, `VITE_STUDENT_REGISTRATION_URL` | Optional full-URL overrides for the account API (set both or neither) |
| `VITE_STUDENT_API_MODE` | `mock` (default) or `live` for the dashboard data; `live` is development-only |

There is no student-id variable: the student is the signed-in user.

When the remaining backend work lands:

1. **Dashboard API validates Cognito tokens:** in `studentHttpGet`, send
   `Authorization: Bearer ${await getAccessToken()}` instead of
   `X-Dev-Student-Id`, then lift the production-build restriction on live
   mode (`vite.config.ts` and `assertLiveEnv()` in `src/lib/env.ts`).
2. **Account API deployed:** set the account URLs (or `VITE_API_BASE_URL`) in
   the hosting environment and add the production origin to the backend CORS
   configuration.
3. **Real SMS verification:** return the real provider from
   `getPhoneVerificationService()` (`src/features/auth/services/phoneVerification.ts`);
   the Verify Phone screen only depends on the `PhoneVerificationService`
   interface. Remove the development-only OTP hint in `VerifyPhonePage.tsx`
   once the mock is no longer needed.
