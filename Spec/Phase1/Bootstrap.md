# Phase 1 Bootstrap — 90 Days Goal & Coaching App

## Project Overview
90 Days is a personal & team goal system built around fixed 90-day cycles. Users create **Objectives**, break them into **KRs** and **Tasks**, and (in later phases) get help from an AI Coach.  
**Phase 1** delivers a minimal, working app with local **username/password** auth, SQLite database, a soft-purple theme (CSS), and the base UI shell.


## Tech Stack & Conventions
- **Framework:** **Next.js** with the **App Router** (`/app` directory), **JavaScript only** (no TypeScript).
- **APIs:** **Route Handlers** under `app/api/*/route.js` (no Express, no `/pages/api` in Phase 1).
- **Styling:** **Plain CSS** (no Tailwind).  
  - Global theme via CSS variables in `styles/theme.css` (soft-purple).  
  - Base/reset in `styles/app.css`.  
  - Per-component CSS Modules (e.g., `Component.module.css`).  
  - **Never hardcode colors** — always use variables from `theme.css`.
- **State:** Local component state only (no global state lib in Phase 1).
- **Language:** JavaScript with JSDoc typedefs and PropTypes (where helpful).
- **Database:** SQLite (file on disk), accessed from server components/route handlers only.



## Where to Find Phase 1 Requirement Specs
- **UI Specs** → `/Phase1/UI/`  
  Screens: App shell (header + left menu), Login, Signup, “/” placeholder.  
  Includes layout rules and which CSS variables to use.
- **API Specs** → `/Phase1/API`  
  Contracts for `/api/signup`, `/api/login`, `/api/me` (methods, payloads, responses, errors).
- **DB Specs** → `/Phase1/DB`  
  Column lists (no SQL) for the `users` table used in Phase 1.
- **Logo** → `/Phase1/90d-logo.png`


## Theme (Soft Purple)
Define in `styles/theme.css` and **only** use variables in component CSS:
- Brand: `--brand: #8a7ccf; --brand-600: #7463c1; --brand-200: #d6d0f2;`
- Surfaces: `--bg`, `--surface`, `--card`, `--border`
- Text: `--text`, `--muted`
- Status: `--success`, `--warn`, `--danger`
- Progress: `--progress-obj`, `--progress-kr`
- Shadows & radii: `--shadow-1`, `--shadow-2`, `--radius-sm|md|lg`
- Spacing & type scales: `--space-*`, `--text-*`
- **Dark mode** via `html[data-theme="dark"] { … }`

**Acceptance (theme):** toggling `data-theme="dark"` on `<html>` updates colors; no hex literals appear in component CSS.



## 🚀 Run Locally
1) Install deps and scaffold Next.js (JS, App Router).  
2) Create SQLite file and run `/DB/schema.sql` once to init `users`.  
3) Start dev server: `npm run dev`.  
4) Visit `http://localhost:3000`.


## ✅ Phase 1 Acceptance Checklist
- App boots with **App Router** and **JavaScript** (no TypeScript files).  
- Global CSS loaded from `styles/theme.css` and `styles/app.css`.  
- No inline styles; component CSS uses **only** theme variables.  
- Signup creates a user; Login authenticates and sets a session cookie.  
- `/api/me` returns the current user when logged in (401 otherwise).  
- Header shows logo and greeting; Left menu highlights the active route.  
- Dark mode works via `data-theme="dark"`.


## 🔭 What’s Next (Phase 2+ preview)
- Org/team and OKRT tables; Objective/KR/Task screens.  
- AI Coach (intent routing + prompts + card actions).  
- Invitations, sharing, vision board per objective.
