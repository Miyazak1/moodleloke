# Google OAuth Login Integration Plan

## Goal

Add production-ready Google account login while keeping CSCAlite's local account, role, refresh session, and authorization model as the source of truth.

Google should only prove the user's identity. CSCAlite should still create or resolve the local `User`, enforce account status and roles, and issue the existing access token plus refresh cookie.

## Current State

- Frontend login and registration are handled by `frontend/src/pages/PublicAuthPage.tsx`.
- Email/password auth calls `login()` and `register()` from `frontend/src/lib/auth.ts`.
- Backend auth is implemented in `backend/src/auth/auth.controller.ts` and `backend/src/auth/auth.service.ts`.
- The backend already issues:
  - short-lived access tokens
  - refresh tokens bound to `RefreshSession`
  - HttpOnly refresh cookies
  - CSRF cookies for cookie refresh/logout
- The current `User` model requires `passwordHash`.
- There is no OAuth account mapping table yet.

## Recommended Architecture

Use Google OAuth/OpenID Connect for identity verification, then reuse CSCAlite's existing token/session flow.

Flow:

1. User clicks "Continue with Google" on the auth page.
2. Frontend navigates to the backend Google OAuth start endpoint.
3. Backend creates and validates OAuth `state`.
4. Google redirects back to the backend callback with `code` and `state`.
5. Backend exchanges `code` plus PKCE verifier for Google tokens and verifies the ID token.
6. Backend resolves or creates the local CSCAlite user.
7. Backend calls the existing auth result/session logic.
8. Backend sets refresh/CSRF cookies and redirects back to the frontend.
9. Frontend loads the current user through the existing auth session flow.

Do not use the Google access token as the CSCAlite business token.

## Database Changes

### Update `User`

Google-only users do not have a password, so `passwordHash` should become nullable.

```prisma
model User {
  id           Int      @id @default(autoincrement())
  loginName    String?  @unique @map("login_name") @db.VarChar(50)
  email        String?  @unique @db.VarChar(255)
  passwordHash String?  @map("password_hash") @db.VarChar(255)
  role         UserRole @default(student)
  status       UserStatus @default(active)
  displayName  String?  @map("display_name") @db.VarChar(100)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  oauthAccounts OAuthAccount[]
}
```

### Add `OAuthAccount`

```prisma
model OAuthAccount {
  id             String   @id @default(cuid())
  userId         Int      @map("user_id")
  provider       String   @db.VarChar(32)
  providerUserId String   @map("provider_user_id") @db.VarChar(191)
  email          String?  @db.VarChar(255)
  emailVerified  Boolean  @default(false) @map("email_verified")
  displayName    String?  @map("display_name") @db.VarChar(100)
  pictureUrl     String?  @map("picture_url") @db.VarChar(500)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId], map: "uniq_oauth_provider_subject")
  @@index([userId], map: "idx_oauth_accounts_user")
  @@index([email], map: "idx_oauth_accounts_email")
  @@map("oauth_accounts")
}
```

## Backend API Design

Add two endpoints:

```text
GET /api/v1/auth/google/start
GET /api/v1/auth/google/callback
```

### `GET /api/v1/auth/google/start`

Responsibilities:

- Accept optional `redirect` query parameter.
- Validate that `redirect` is a safe local path.
- Generate an OAuth `state`.
- Generate a PKCE `code_verifier` and `code_challenge`.
- Store `state`, `code_verifier`, and redirect target in a short-lived HttpOnly cookie.
- Redirect to Google's OAuth authorization endpoint.

Recommended scopes:

```text
openid email profile
```

Authorization request requirements:

- `response_type=code`
- `client_id=GOOGLE_CLIENT_ID`
- `redirect_uri=GOOGLE_OAUTH_REDIRECT_URI`
- `scope=openid email profile`
- `state=<random state>`
- `code_challenge=<S256 challenge>`
- `code_challenge_method=S256`

The state cookie should be:

- HttpOnly
- Secure in production
- SameSite=Lax
- short-lived, for example 10 minutes
- cleared immediately after callback, regardless of success or failure

### `GET /api/v1/auth/google/callback`

Responsibilities:

- Validate `state`.
- Exchange authorization `code` and PKCE `code_verifier` for tokens.
- Verify the Google ID token.
- Require:
  - valid Google signature through Google JWKS or a trusted Google auth library
  - trusted issuer
  - audience equals `GOOGLE_CLIENT_ID`
  - non-expired token
  - stable `sub`
  - verified email for automatic account creation or binding
- Resolve or create a local user.
- Set the same refresh and CSRF cookies used by email/password login.
- Redirect to the frontend.

Do not log the authorization `code`, Google tokens, ID token, state cookie, or refresh tokens.

## Redirect Safety

The OAuth `redirect` parameter must be treated as untrusted input.

Allowed:

```text
/me
/schools/1
/csca-mock-exam
```

Rejected:

```text
https://evil.example
//evil.example
/\evil
javascript:alert(1)
```

Implementation rule:

- Accept only strings that start with exactly one `/`.
- Reject strings starting with `//`.
- Reject strings containing control characters.
- Optionally restrict to known app routes.
- Fallback to `/me` when invalid.

## Account Resolution Rules

1. If an `OAuthAccount` exists for `provider = "google"` and Google `sub`, use that user.
2. If no OAuth account exists, but Google email is verified and a local user with the same email exists, bind the Google account to that user.
3. If no local user exists and Google email is verified, create a new `student` user and bind the Google account.
4. If the resolved user is `disabled`, reject login.
5. If Google email is not verified, reject automatic login/binding.

### Admin Binding Rule

Do not automatically bind Google login to an existing `admin` user by email during the public OAuth callback.

Recommended rule:

- Auto-bind by verified email only for non-admin users.
- Existing admin users must bind Google from an authenticated admin account settings flow, or be bound through an explicit admin allowlist/manual migration.
- If a Google login matches an existing admin email but has no OAuth account yet, reject with a safe message and ask the admin to use password login first.

Reason:

- Google `email_verified` proves control of that Google mailbox, but admin account binding is a privilege boundary in CSCAlite.
- Requiring an already authenticated admin session or manual allowlist reduces account takeover risk from misconfigured domains, stale admin emails, or unintended mailbox ownership changes.

## Password Login Changes

Since `passwordHash` becomes nullable:

- Email/password login must reject users with no password hash.
- Suggested message: "这个账号使用 Google 登录。请使用 Google 登录，或登录后设置密码。"
- Password update should only work for users who have an existing password unless a dedicated "set password" flow is added.
- Any code path that verifies a password must guard against `null` `passwordHash`.
- Admin user creation should continue to require a password unless a separate admin invite/OAuth binding flow is added.

## Frontend Changes

Update `frontend/src/pages/PublicAuthPage.tsx`.

Add a Google login action:

```ts
function continueWithGoogle() {
  const redirect = redirectTo ?? '/me';
  window.location.href = `${API_BASE}/api/v1/auth/google/start?redirect=${encodeURIComponent(redirect)}`;
}
```

UX requirements:

- Add a clear "Continue with Google" button above or below the email/password form.
- Keep email/password login and registration available.
- Show failure messages from query params, for example:
  - `/auth?error=google_failed`
  - `/auth?error=google_denied`
  - `/auth?error=account_disabled`
- Preserve redirect behavior after successful login.

## Environment Variables

Development:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
PUBLIC_APP_ORIGIN=http://localhost:5174
CORS_ORIGINS=http://localhost:5174
```

Production:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://your-domain.com/api/v1/auth/google/callback
PUBLIC_APP_ORIGIN=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
```

Use the existing `PUBLIC_APP_ORIGIN` value when redirecting back to the frontend after OAuth success or failure. Avoid adding a second frontend origin env var unless a future deployment truly needs separate public and app origins.

Google Cloud Console must also include:

```text
Authorized JavaScript origins:
https://your-domain.com

Authorized redirect URIs:
https://your-domain.com/api/v1/auth/google/callback
```

For local development, add:

```text
http://localhost:3000/api/v1/auth/google/callback
```

## Google Cloud Setup

Use Google Cloud Console OAuth credentials, not Google Identity Platform.

Required setup:

- Create a Google Cloud project.
- Configure OAuth consent screen.
- Add app name, support email, domain, privacy policy, and terms if available.
- Create a Web application OAuth client.
- Use only `openid email profile` scopes.

Using only Google sign-in with basic profile scopes should not require paid Google services.

## Security Notes

- Always validate OAuth `state`.
- Use PKCE with `S256`.
- Make OAuth state one-time use.
- Do not trust identity data sent directly from the browser.
- Do not use Google access tokens as CSCAlite API tokens.
- Store `GOOGLE_CLIENT_SECRET` only on the backend.
- Use Google `sub` as the stable provider user id.
- Verify the ID token signature with Google JWKS or a trusted Google auth library.
- Verify ID token `iss`, `aud`, `exp`, `iat`, and `sub`.
- Only auto-bind by email when `email_verified` is true.
- Do not auto-bind public Google login to existing admin accounts.
- Strictly validate post-login redirect paths to prevent open redirects.
- Keep refresh tokens in the existing HttpOnly cookie flow.
- Keep CSRF checks for cookie refresh/logout.
- Reject disabled users after resolving the local account.
- Do not store Google access tokens or refresh tokens unless CSCAlite later needs Google API access. Basic sign-in does not require storing them.

## Test Plan

Backend tests:

- New verified Google user creates `User` and `OAuthAccount`.
- Returning Google user resolves the same local user.
- Existing non-admin email/password user with verified matching Google email is bound.
- Existing admin email/password user with verified matching Google email is not auto-bound through public OAuth.
- Unverified Google email is rejected.
- Disabled local user is rejected.
- Invalid or missing state is rejected.
- Reused state is rejected.
- Missing or invalid PKCE verifier is rejected by callback/token exchange handling.
- Unsafe redirect values fall back to `/me` or are rejected.
- Callback sets refresh and CSRF cookies.
- Email/password login still works for password users.
- Email/password login rejects Google-only users without `passwordHash`.

Frontend tests:

- Google button redirects to `/api/v1/auth/google/start`.
- Redirect parameter is preserved.
- Auth error query params render friendly messages.
- Existing email/password login and registration still work.
- After a mocked Google callback/session, `/me` loads the current user.

Smoke tests:

- Local Google login with a test Google account.
- Production/staging redirect URI verification.
- Login from a protected route returns to the original route after Google auth.

## Implementation Order

1. Update Prisma schema and create migration.
2. Update auth service for nullable `passwordHash`.
3. Add OAuth account resolution logic.
4. Add Google OAuth configuration helpers, redirect validation, state cookie, and PKCE helpers.
5. Add Google start/callback controller endpoints.
6. Reuse existing auth result and cookie setting logic.
7. Add frontend Google login button and error states.
8. Add tests.
9. Run build and smoke verification.
10. Configure production Google OAuth credentials and consent screen.

## Open Decisions

- Whether to store Google `picture` now or defer avatar support.
- Whether to add a "set password" flow for Google-only users.
- Whether admin Google binding should be supported through an authenticated admin settings flow in this phase or deferred.
- Whether OAuth state should use only a short-lived HttpOnly cookie or a server-side store as well. The default implementation should start with a short-lived one-time HttpOnly cookie unless distributed callback handling requires server-side storage.
