# Event Manager — Backend

NestJS REST API for the Event Manager application.

| Concern            | Choice                                              |
| ------------------ | --------------------------------------------------- |
| Framework          | NestJS 11 (Express)                                 |
| Language           | TypeScript (strict)                                 |
| Database           | PostgreSQL                                          |
| ORM                | **Prisma 7** (`prisma/schema.prisma` = source of truth) |
| Auth credentials   | **Supabase Auth** (passwords, sessions, email verification, recovery) |
| API tokens         | JWT issued by this backend (`Authorization: Bearer <token>`) |
| Validation         | class-validator / class-transformer (global `ValidationPipe`: whitelist, forbidNonWhitelisted, transform) |
| Docs               | Swagger/OpenAPI at `/api/docs`                      |
| Tests              | Jest (unit) + Jest e2e (`test/`)                    |

## Architecture

```
Frontend ──► NestJS REST API
                ├── AuthModule (register / login / verify-email / resend-verification /
                │               forgot-password / reset-password / refresh / me)
                ├── UsersModule (/users/me)
                └── PrismaService ──► PostgreSQL
Credentials & verification emails: Supabase Auth (source of truth).
This backend NEVER stores passwords or password hashes.
```

- Controllers stay thin; business logic lives in services.
- `JwtAuthGuard` is registered globally (`APP_GUARD`): every route requires a
  valid Bearer JWT unless decorated with `@Public()`.
- After a successful Supabase credential check, the backend issues its own JWT
  (single consistent token mechanism) and mirrors the user into PostgreSQL
  keyed by `supabaseUserId` (unique).

## Getting started

```bash
cd backend
cp .env.example .env        # then fill in real values (see below)
npm install
npm run prisma:generate     # generates the Prisma Client
npm run prisma:migrate      # creates/applies migrations (needs PostgreSQL running)
npm run start:dev           # http://localhost:4000, Swagger at /api/docs
```

### Environment variables (`backend/.env`, gitignored)

| Variable                    | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `PORT`                      | API port (default 4000)                                            |
| `DATABASE_URL`              | PostgreSQL connection string (Prisma driver adapter + CLI)          |
| `JWT_SECRET`                | Secret for JWTs issued by THIS backend — use a long random string |
| `JWT_EXPIRES_IN`            | JWT lifetime, e.g. `1d`                                            |
| `SUPABASE_URL`              | Supabase project URL                                               |
| `SUPABASE_ANON_KEY`         | Supabase anon/public key                                           |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **Server-side secret — backend only, never the frontend, never committed** |
| `FRONTEND_URL`              | Redirect target for verification/reset emails (e.g. `http://localhost:5173`) |

## Auth endpoints

| Method | Path                        | Auth   | Description                                        |
| ------ | --------------------------- | ------ | -------------------------------------------------- |
| POST   | `/auth/register`            | Public | Create Supabase user, Supabase sends verification email |
| POST   | `/auth/login`               | Public | Verify credentials via Supabase; rejects unverified emails; returns JWT |
| POST   | `/auth/verify-email`        | Public | Complete verification using the email link credential (`code` or `tokenHash`/`token`) |
| POST   | `/auth/resend-verification` | Public | Resend confirmation email (generic response)       |
| POST   | `/auth/forgot-password`     | Public | Supabase sends the recovery email                  |
| POST   | `/auth/reset-password`      | Public | Set new password via recovery credential           |
| POST   | `/auth/refresh`             | Public | Exchange refresh token for a new JWT               |
| GET    | `/auth/me`                  | Bearer | Current user                                       |
| GET    | `/users/me`                 | Bearer | Current user (UsersModule)                         |

Error responses carry machine-readable `code`s, e.g. `EMAIL_ALREADY_EXISTS`,
`EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`, `INVALID_VERIFICATION`,
`INVALID_RESET_LINK`, `TOKEN_EXPIRED`, `UNAUTHORIZED`, `RATE_LIMITED`.

## Supabase dashboard configuration (manual, one-time)

These cannot be configured from code:

1. **Authentication → Providers → Email**
   - Email provider: **Enabled**
   - **Confirm email: ON** (verification required before sign-in)
2. **Authentication → URL Configuration**
   - Site URL: your `FRONTEND_URL` (e.g. `http://localhost:5173`)
   - Redirect URLs allowlist — add:
     - `<FRONTEND_URL>/auth/verify` (email confirmation link)
     - `<FRONTEND_URL>/auth/reset-password` (password reset link)
3. **Authentication → Email Templates** — optional branding; keep the
   default confirmation/recovery links.

## Prisma 7 specifics

- The connection URL is **not** in `schema.prisma`. The CLI reads it from
  `prisma.config.ts`; the runtime client receives it through the `PrismaPg`
  driver adapter (`src/database/prisma.service.ts`).
- `npm run prisma:migrate` → `prisma migrate dev` (development, creates
  migration folders under `prisma/migrations/`).
- `npm run prisma:migrate:deploy` → production deploys.
- Note for restricted networks: if `binaries.prisma.sh` is unreachable,
  `prisma generate` still works (schema validation is WASM-based) but
  engine-dependent commands may need network access on an unrestricted
  machine.

## Scripts

| Script                     | Purpose                          |
| -------------------------- | -------------------------------- |
| `npm run build`            | Compile to `dist/`               |
| `npm run typecheck`        | `tsc --noEmit`                   |
| `npm run start:dev`        | Dev server with watch            |
| `npm test`                 | Jest unit tests                  |
| `npm run test:e2e`         | Jest e2e tests                   |
| `npm run prisma:generate`  | Generate Prisma Client           |
| `npm run prisma:migrate`   | Create/apply dev migrations      |
| `npm run prisma:studio`    | Prisma Studio                    |

## Database schema

`prisma/schema.prisma` is the source of truth. Models: `User`,
`Organization`, `Hall`, `Event`, `Attendee`, `Pass`, `CheckIn`, `Task`,
`Notification`, `File`. Enums: `UserRole`, `TaskStatus`, `TaskPriority`,
`NotificationType`. Event lifecycle status (Upcoming/Ongoing/Ended) is
computed from `startsAt`/`endsAt` and intentionally not stored.

## Security notes

- No passwords, hashes or Supabase secrets in code, logs, or API responses.
- `.env` is gitignored; `.env.example` is the committed template.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the frontend.
- Double check-ins are impossible at the DB level (`CheckIn.passId` unique).
- Hall double-booking checks use the `@@index([hallId, startsAt, endsAt])`
  index and are enforced by the backend, never the frontend alone.
