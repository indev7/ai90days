# Authentication and Authorization Architecture

This document describes how sign-in works, how sessions are maintained, and how API authorization is enforced in this codebase. It covers both email/password and Microsoft (Azure AD) login flows.

## High-level overview

The app supports two auth paths:
- Email/password login backed by a custom JWT session cookie (`sid`).
- Microsoft OAuth via NextAuth (Azure AD), which also issues the same custom JWT cookie so downstream API routes can use a consistent session check.

Session state is stored in an HTTP-only cookie and checked on API routes. Some endpoints also accept a NextAuth session for Microsoft logins.

## Core auth libraries

- `next-auth` for Microsoft OAuth (`app/api/auth/[...nextauth]/route.js`).
- `jose` for signing/verifying the custom JWT session (`lib/auth.js`).
- `bcryptjs` for password hashing/verification (`lib/auth.js`).

## Email/password sign-in flow

1. User submits credentials from `app/login/page.js` to `POST /api/login`.
2. `app/api/login/route.js`:
   - Looks up user by email (`lib/pgdb.js`).
   - Verifies password with bcrypt (`lib/auth.js`).
   - Calls `createSession(user)` to issue a `sid` JWT cookie.
3. Client redirects to `/home` and triggers a local storage event to refresh cached auth state.

Related files:
- `app/login/page.js`
- `app/api/login/route.js`
- `lib/auth.js`

## Signup flow (email/password)

1. User submits form from `app/signup/page.js` to `POST /api/signup`.
2. `app/api/signup/route.js`:
   - Validates email/password format.
   - Hashes password with bcrypt.
   - Creates user in Postgres.
   - Calls `createSession(user)` to issue `sid`.

Related files:
- `app/signup/page.js`
- `app/api/signup/route.js`
- `lib/auth.js`
- `lib/pgdb.js`

## Microsoft sign-in flow (Azure AD via NextAuth)

1. User clicks "Continue with Microsoft" on the login/signup page.
2. Client calls `signIn('azure-ad')` from `next-auth/react`:
   - `app/login/page.js`
   - `app/signup/page.js`
3. NextAuth handles OAuth in `app/api/auth/[...nextauth]/route.js`:
   - Provider: `AzureADProvider`.
   - Scopes: `openid profile email User.Read Calendars.Read offline_access`.
   - JWT session strategy.
4. `callbacks.signIn`:
   - Enforces an allowlist of email domains.
   - Creates or updates the user record with Microsoft profile data.
   - Persists Microsoft access/refresh tokens and expiration in the `users` table.
   - Calls `createSession(existingUser)` to also issue the custom `sid` JWT cookie.

Related files:
- `app/api/auth/[...nextauth]/route.js`
- `lib/pgdb.js`
- `Phase1/PGDB/schema.sql`

## Session management

Custom session cookie:
- Name: `sid`.
- Signed with `SESSION_SECRET` using `jose` (HS256).
- Stored as HTTP-only cookie for 7 days.
- Created in `lib/auth.js:createSession`.

Session retrieval:
- `getSession()` reads `sid` from `next/headers` cookies (server-only).
- `verifySession(request)` parses cookies from request headers for API routes that receive a `Request` object directly.

NextAuth session:
- Stored in NextAuth cookies (ex: `next-auth.session-token`).
- Used in some routes via `getServerSession` when no custom `sid` is present.

Related files:
- `lib/auth.js`
- `app/api/me/route.js`
- `app/api/comments/route.js`

## API authorization patterns

There are two common approaches in API routes:

1) Custom JWT (preferred path)
   - `getSession()` or `verifySession(request)` reads `sid`.
   - If `session?.sub` is missing, return `401`.
   - Use `session.sub` as the authenticated user id.

Examples:
- `app/api/llm/route.js`
- `app/api/aime/route.js`
- `app/api/time-blocks/[id]/route.js`
- `app/api/calendar/route.js`

2) NextAuth fallback (Microsoft logins)
   - If `getSession()` returns null, call `getServerSession` and map `session.user.email` to a user record.

Examples:
- `app/api/me/route.js`
- `app/api/comments/route.js`
- `app/api/comments/[id]/route.js`
- `app/api/comments/rewards/route.js`

Authorization checks typically validate ownership:
- Time blocks: verify `timeBlock.user_id === session.sub`.
- Comments: only sender can edit/delete (`sending_user === user.id`).

## Microsoft Graph usage and token lifecycle

Microsoft access/refresh tokens are stored in the `users` table:
- `microsoft_access_token`
- `microsoft_refresh_token`
- `microsoft_token_expires_at`

When calling Graph:
- `app/api/calendar/route.js` checks token expiry, refreshes if needed, and updates the DB.
- `lib/mainTreeLoader.js` uses the same token refresh strategy.

## Environment variables

Auth-related env vars used in code:
- `SESSION_SECRET` (custom JWT signing).
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `NODE_ENV` (secure cookie flag).

## Notes for architectural discussions

- Two session mechanisms exist: NextAuth session cookies and a custom JWT cookie (`sid`). The Microsoft OAuth flow explicitly creates the custom JWT so downstream API routes can use a consistent session check.
- Some API routes only check the custom `sid` and will fail if a user has a NextAuth session but no custom `sid` (for example, if the custom cookie were not set).
- Microsoft tokens are stored directly on the `users` table and refreshed server-side when expired.
- Domain allowlist enforcement for Microsoft sign-in is implemented in the NextAuth `signIn` callback.
