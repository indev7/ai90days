# 90 Days Goal & Coaching App - Development Guide

## Quick Commands
- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Start**: `npm start`

## Project Structure
- **Framework**: Next.js with App Router (JavaScript only)
- **Database**: PostgreSQL (Prisma)
- **Styling**: CSS Modules + theme variables in `styles/theme.css`
- **Authentication**: JWT sessions with `jose` library

## Key Features (Phase 1 & 2)
- User signup/login with email/password
- Microsoft OAuth login with account linking
- Responsive navigation (mobile hamburger + desktop left rail)
- Modern vibrant theme with dark mode support
- PostgreSQL database with user management
- Profile editing with first/last name and password changes
- Avatar dropdown with profile pictures

## Environment
- Copy `.env.local` for session secret
- Database schema managed via `Phase1/PGDB/` scripts
- Logo located at `/public/brand/90d-logo.png`

## Theme System
- All colors use CSS variables from `styles/theme.css`
- Dark mode: `html[data-theme="dark"]`
- Never hardcode hex colors in components
