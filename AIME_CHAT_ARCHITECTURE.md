# Architecture Summary (Concise)

This document provides a simple, high-level architecture summary for the Aime/OKRT platform, focusing only on the selected sections.

## 1. System Overview (Context)

- **Product**: Aime is a 90‑day OKRT planning and coaching web app with a built‑in AI chat experience.
- **Client**: Users access the app via a browser (desktop and mobile).
- **Backend**: Next.js App Router provides UI and API routes in the same application.
- **Core services**: PostgreSQL for data, Microsoft OAuth for enterprise login, and LLM providers for coach chat.

## 2. Data Model and Storage

- **Primary datastore**: PostgreSQL stores users, OKRTs, groups, shares, comments, notifications, and time blocks.
- **Shared OKR access**: Shared objectives are mapped via share records and group membership.
- **Aggregated read model**: A `mainTree` structure is built in the API and cached client-side for fast navigation.

## 3. API / Interface Contracts

- **REST-style API routes** under `app/api/` for authentication, OKRT CRUD, groups, comments, notifications, time blocks, calendar, and AI.
- **AI chat endpoint**: `/api/aime` streams JSONL chunks (`content`, `actions`, `req_more_info`, `done`) consumed by the chat UI.
- **Cache updates**: Some write endpoints return a `_cacheUpdate` payload to refresh the client state without full refetch.

## 4. Authentication and Authorization

- **Authentication**: Custom JWT (`sid`) cookie for email/password and Microsoft OAuth, described in `AUTH_ARCHITECTURE.md`.
- **Authorization**: API routes validate ownership and group membership before returning or mutating OKRT data.
- **Session security**: HTTP‑only cookies and server-side session verification on protected routes.

## 5. Logging (Concise)

- **Current**: Standard server logs and request logging on the API routes.
- **Planned**: Persist AI conversations to S3 (transcript + metadata) for audit and retention.
  - Recommended metadata: user ID, session ID, provider, timestamps, and tool usage.

## References

- `ARCHITECTURE_OVERVIEW.md`
- `ARCHITECTURE.md`
- `AUTH_ARCHITECTURE.md`
