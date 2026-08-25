# Auth — Frontend Integration Guide

How the existing React auth screens map to the backend API. No frontend
changes are made by the backend team; this document is the wiring contract.

Base URL (dev): `http://localhost:4000` — API docs at `/api/docs`.

## 1. Field mapping

| Frontend (`src/Features/auth`) | Backend API            |
| ------------------------------ | ---------------------- |
| `fullName` (SignUpScreen)      | `name`                 |
| `email`                        | `email`                |
| `password`                     | `password`             |
| `role` (`'ADMIN' \| 'ATTENDEE'`) | `role` (optional on register; server returns it on login) |

The frontend `User` type (`id, name, email, role, avatarUrl?`) matches the
`user` object returned by every auth endpoint (extra fields like
`createdAt`/`supabaseUserId` are safe to ignore).

## 2. Sign up — `SignUpScreen`

```ts
const res = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: fullName, email, password, role }),
});
const data = await res.json();
```

- `201` + `emailVerificationRequired: true` → show a **"Check your inbox"**
  screen instead of logging in (Supabase sent the verification email).
- `201` + `emailVerificationRequired: false` (email confirmation disabled)
  → `data.accessToken` is present; proceed like after login.
- `409` (`EMAIL_ALREADY_EXISTS`) → "An account with this email already exists."
- `400` → show `data.message` (field-level validation errors).

After successful registration with verification required, route the user to
**login**, matching `onSignUpSuccess(role)` → navigate-to-login behavior.

## 3. Email verification callback — route `/auth/verify`

Supabase redirects the verification link to `FRONTEND_URL/auth/verify` with
params from the email. Create a React Router route that forwards them.

⚠️ **Read the credential from BOTH the query string and the hash fragment.**
Supabase's default (**implicit**) flow puts the credential in the URL **hash**
(e.g. `/auth/verify#token_hash=…` or `#access_token=…&refresh_token=…&type=signup`),
not the query string. Reading only `window.location.search` drops it and the
backend 400s with `MISSING_VERIFICATION_CREDENTIAL`
(`"Provide one of: code, tokenHash or token"`). Merge both:

```ts
// Merge query string + hash fragment into one param map.
const params = new URLSearchParams(window.location.search);
const hash = window.location.hash.replace(/^#/, '');
new URLSearchParams(hash).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
```

Two cases:

**(a) Link carries a relay-able credential (`token_hash`/`token`/`code`):** forward to
`POST /auth/verify-email`:

```tsx
const body = {
  code: params.get('code') ?? undefined,          // PKCE flow
  tokenHash: params.get('token_hash') ?? undefined, // implicit flow
  token: params.get('token') ?? undefined,        // legacy flow
  email: params.get('email') ?? undefined,        // needed for legacy token
  type: 'signup',
};
const res = await fetch(`${API}/auth/verify-email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

**(b) Link already carries a Supabase session (`access_token` in the hash):**
relay it to `POST /auth/verify-session`, which validates it and returns a
login-shaped response (app JWT + refresh token) so the user is signed in
immediately:

```ts
const res = await fetch(`${API}/auth/verify-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  }),
});
// 200 → store tokens exactly like POST /auth/login; user is authenticated.
```

- `200` (either path) → show "Email verified" → navigate to login (or, for the
  `verify-session` path, straight into the app since tokens are already stored).
- `400` (`INVALID_VERIFICATION`) → "This link is invalid or has expired" +
  offer **resend**:

```ts
await fetch(`${API}/auth/resend-verification`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});
```

## 4. Login — `LoginScreen`

```ts
const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
```

- `200` → store tokens and user:
  ```ts
  localStorage.setItem('gatepass_tokens', JSON.stringify({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
  }));
  // data.user satisfies the frontend User type (id, name, email, role, avatarUrl)
  login(...) // AuthContext — use data.user.name / data.user.role
  ```
  ⚠️ Ignore the role toggle on the login screen for real API calls — the
  server returns the authoritative role.
- `401` (`INVALID_CREDENTIALS`) → "Invalid email or password".
- `403` (`EMAIL_NOT_VERIFIED`) → "Please verify your email first" + resend link.
- Google sign-in (Nice-to-have) is not implemented on the backend yet.

## 5. Forgot password — `ForgotPasswordScreen`

```ts
await fetch(`${API}/auth/forgot-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});
// Always show the "if the account exists, a link was sent" success state.
```

Reset callback route `/auth/reset-password` (Supabase redirects there).
Same hash-fragment caveat applies — merge `window.location.search` and
`window.location.hash` before reading the params:

```ts
const params = new URLSearchParams(window.location.search);
new URLSearchParams(window.location.hash.replace(/^#/, ''))
  .forEach((v, k) => { if (!params.has(k)) params.set(k, v); });

const body = {
  code: params.get('code') ?? undefined,
  tokenHash: params.get('token_hash') ?? undefined,
  token: params.get('token') ?? undefined,
  email: params.get('email') ?? undefined,
  newPassword, // from your new-password form
};
await fetch(`${API}/auth/reset-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
// 200 → navigate to login · 400 (INVALID_RESET_LINK) → ask for a new link
```

## 6. Authenticated requests + refresh

Every protected call sends the JWT:

```ts
const res = await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

- `401` + `code: 'TOKEN_EXPIRED'` → refresh once, then retry:
  ```ts
  const r = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  // 200 → store new accessToken/refreshToken · 401 → logout()
  ```
- `401` + `code: 'UNAUTHORIZED'` → logout and route to login.

## 7. Logout

JWTs are stateless — logout is purely client-side (already what
`AuthContext.logout()` does): clear `gatepass_tokens` + `gatepass_mock_user`
from localStorage.

## Error codes reference

| Code | HTTP | Meaning |
| ---- | ---- | ------- |
| `EMAIL_ALREADY_EXISTS` | 409 | Duplicate registration |
| `WEAK_PASSWORD` | 400 | Password rejected by Supabase policy |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked until email is verified |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password or unknown account |
| `INVALID_VERIFICATION` | 400 | Verification link invalid/expired/used |
| `INVALID_RESET_LINK` | 400 | Reset link invalid/expired/used |
| `MISSING_VERIFICATION_CREDENTIAL` | 400 | No code/tokenHash/token provided |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid/expired |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `RATE_LIMITED` | 429 | Too many emails/attempts — retry later |
| `PROVIDER_ERROR` | 502 | Supabase sign-up failed — retry |
