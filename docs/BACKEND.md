# Backend & Cognito dependencies

The frontend currently runs against `MockAuthService`. This document captures
exactly what the real backend and the Cognito User Pool must provide before
`CognitoAuthService` can replace the mock, and where the integration seams
live in the frontend code.

## Amazon Cognito User Pool

| Setting                | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| User pool type         | Standard, with Google as a federated identity provider  |
| App client             | **Public** (no client secret) — PWA cannot keep secrets |
| Auth flows             | OAuth 2.0 Authorization Code + PKCE                     |
| Hosted UI domain       | e.g. `hiremebot.auth.us-east-1.amazoncognito.com`       |
| Allowed callback URL   | `https://<app>/auth/callback`                           |
| Allowed sign-out URL   | `https://<app>/login`                                   |
| Scopes                 | `openid email profile`                                  |
| Identity provider      | Google (OIDC with verified email claim required)        |
| Attribute mapping      | Map Google `sub` → Cognito `sub`; `email` → `email`     |

Notes:

- Email **must** come from Google and the backend must independently check
  the `email_verified` claim before trusting it.
- Use the Cognito stable `sub` as the identity reference everywhere — never
  the email string.
- A browser-based PWA uses a public app client without a client secret. If
  the team adopts a backend-for-frontend session architecture (HttpOnly
  cookies instead of browser tokens), rewrite `CognitoAuthService` to call
  that BFF — no token storage in JavaScript.

## Required backend endpoints

All endpoints must be fronted by API Gateway and secured appropriately. The
frontend expects the following contracts (shapes may evolve during API
design — the point is which capabilities exist):

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
the pending registration, returns the authenticated user payload (or sets a
session cookie if using a BFF).

### `GET /auth/me`

Returns the current activated user (`{ id, role, firstName, lastName, email,
phoneE164, activated }`) or 401. Used by `AuthProvider` on load.

### `POST /auth/logout`

Clears the server session (and any Cognito refresh token) and returns 204.

## Security requirements

- OTP generation, expiry, resend limits, attempt limits and single-use
  invalidation live on the backend. The frontend's 60-second countdown is a
  UX convenience only.
- The `registrationId` returned to the browser must be an opaque token with
  no privileges beyond "may call OTP + activation endpoints for this
  registration until it expires." The server binds it to the Cognito `sub`
  via the signed-in callback — never trust an `?id=` URL parameter.
- Reject any Google identity whose `email_verified` claim is not `true`.
- Role authorization lives server-side. The `/auth/me` payload may advertise
  `role`, but protected APIs must verify independently.
- Public signup must only ever create `STUDENT` users. Recruiter/Manager
  provisioning is out-of-band.
- Never store JWTs or refresh tokens in `localStorage` or the service worker
  cache. Prefer HttpOnly + Secure + SameSite=Lax cookies via a BFF.

## Frontend switch-over

When the backend is live:

1. Set the `VITE_*` variables in `.env.local` (see `.env.example`).
2. Add a factory in `src/features/auth/AuthProvider.tsx` that returns
   `new CognitoAuthService({...})` when `VITE_AUTH_PROVIDER === 'cognito'`.
3. Implement each `notConfigured(...)` stub in
   `src/features/auth/services/CognitoAuthService.ts` by calling the backend
   endpoints above. Where a BFF manages the session, the browser only needs
   to call the backend — the Cognito SDK may not be required at all.
4. Delete the dev-only OTP hint in `VerifyPhonePage.tsx`.
