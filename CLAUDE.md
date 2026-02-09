# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run Next.js linting

## Architecture Overview

This is a **Next.js App Router** application built in JavaScript (not TypeScript) using:

- **Database**: PostgreSQL via Prisma
- **Authentication**: Custom JWT sessions using `jose` library + Microsoft OAuth via NextAuth
- **Styling**: CSS Modules with CSS custom properties in `styles/theme.css`
- **State Management**: React hooks for client-side state, custom auth context in layout

### Key Architectural Patterns

- **Database Layer**: `lib/db.js` provides Prisma access helpers
- **Authentication**: `lib/auth.js` manages JWT sessions, password hashing, and validation
- **Layout System**: Responsive design with desktop left rail navigation and mobile hamburger menu
- **Component Architecture**: All components use CSS Modules for scoped styling

### Database Schema Evolution

The app uses a phased migration approach:
1. **Phase 1**: Basic user authentication with username/password
2. **Phase 2**: Microsoft OAuth integration with account linking
3. **Phase 3**: OKRT (Objectives, Key Results, Tasks) management system

### Authentication Flow

- Custom JWT sessions stored in HTTP-only cookies
- Microsoft OAuth handled via NextAuth.js for social login
- Account linking allows users to connect email and Microsoft accounts
- Session validation in `app/layout.js` controls UI rendering

### Component Structure

- **HeaderBar**: Top navigation with user avatar and branding
- **LeftMenu**: Collapsible sidebar navigation (desktop) / mobile overlay
- **Responsive Logic**: `useMediaQuery` hook determines layout behavior
- **OKRT Components**: Modal-based interface for goal management

### Database Functions

Key database operations in `lib/db.js`:
- User management: `createUser()`, `getUserByEmail()`, `updateUser()`
- OKRT operations: `createOKRT()`, `getOKRTHierarchy()`, `updateOKRT()`
- Schema changes are managed via `Phase1/PGDB/` scripts and Prisma

## Styling System

- **Theme Variables**: All colors defined in `styles/theme.css` using CSS custom properties
- **Dark Mode**: Controlled via `html[data-theme="dark"]` attribute
- **Component Styles**: Each component has corresponding `.module.css` file
- **Never hardcode colors** - always use CSS custom properties from theme

## Environment Setup

- Database schema managed via `Phase1/PGDB/` scripts
- Requires `SESSION_SECRET` environment variable for JWT signing
- Microsoft OAuth credentials needed for social login features
