# Navigation: Mobile Full-Screen Menu + Desktop Left Rail

## Context
- Next.js **App Router** (`/app`), **JavaScript only** (no TypeScript).
- **Plain CSS** with a master theme: `styles/theme.css` (soft-purple variables) + `styles/app.css` (base).
- Global layout via `app/layout.js`. Header at top; left rail on wide screens.

## Goal
Provide a single navigation system that:
- On **mobile (<768px)**: opens from a **top-right hamburger** into a **full-screen overlay** menu.
- On **tablet landscape & desktop (≥1024px)**: shows a **persistent left rail** exactly like the sketch.
- On **tablet portrait (768–1023px)**: uses a **collapsible/docked left rail** (peek width, expandable).

## Routes (Phase 1)
- **Profile** → `/profile`
- **My Goals** → `/goals`
- **Shared with me** → `/shared`
- **New** (Add Goal) → `/new`
- **Coach** → `/coach`
- **Notifications** → `/notifications`
- **Settings** → `/settings`

## Responsive Behavior & Breakpoints
- **Mobile (<768px)**  
  - Header shows **hamburger (top-right)**.  
  - Tapping opens **full-screen overlay** menu (covers viewport).  
  - Body scroll locked while open.  
  - Close via **X**, **backdrop**, **Esc**, or selecting a menu item.
- **Tablet Portrait (768–1023px)**  
  - **Docked/collapsible rail** on the left (narrow width ~72–80px with icons + tooltips).  
  - A toggle expands it to full width (text labels visible).  
  - Content area adjusts accordingly.
- **Tablet Landscape & Desktop (≥1024px)**  
  - **Persistent left rail** (full width, icons + labels) as per sketch.  
  - No overlay; rail is always visible.  
  - Active item highlighted.

## Accessibility
- **Hamburger button** (mobile only):
  - `aria-controls="mobile-menu"`, `aria-expanded="true|false"`, `aria-label="Open menu"`/`"Close menu"`.
- **Mobile overlay**:
  - `role="dialog"`, `aria-modal="true"`, `id="mobile-menu"`.
  - Move focus to first link on open; **trap focus**; return focus to hamburger on close.
  - **Esc** closes; backdrop is clickable.
- **Left rail**:
  - Links have visible focus rings; labels always present (no icon-only without text/tooltip).
  - Current route has `aria-current="page"`.

## Design & CSS Constraints
- **No inline styles. No hardcoded hex.** Use variables from `styles/theme.css`:
  - Surfaces: `--bg`, `--surface`, `--card`, `--border`
  - Text: `--text`, `--muted`
  - Brand: `--brand`, `--brand-600`
  - Radii & shadows: `--radius-lg`, `--shadow-1`, `--shadow-2`
  - Spacing & type scales: `--space-*`, `--text-*`
- **Dark mode**: respect `html[data-theme="dark"]` overrides automatically.
- **Animation**: simple CSS transitions (opacity/transform). Honor `prefers-reduced-motion`.

## Structure
- **Header (always visible)**: logo (left), title/placeholder (center), **hamburger (top-right, mobile only)**, user avatar placeholder (right).
- **Left rail (tablet-landscape/desktop)**: vertical list of items with icons + labels, active highlight; footer area for profile stub if desired.
- **Mobile overlay menu**: full-screen panel with same items, large tap targets (≥44px), close (X) top-right.

## Files to Create / Update
- `components/HeaderBar.js` — renders header; shows **hamburger** only on `<768px`.
- `components/HamburgerButton.js` — accessible button element.
- `components/LeftMenu.js` — left rail (used ≥768px).
- `components/LeftMenu.module.css` — rail styles using theme variables.
- `components/MobileMenu.js` — full-screen overlay menu (<768px).
- `components/MobileMenu.module.css` — overlay styles using theme variables.
- `app/layout.js` — composes `HeaderBar`, conditionally shows `LeftMenu`, mounts `MobileMenu` portal.
- (Optional) `components/NavLink.js` — helper that reads `usePathname()` to set active state.

## Behavior Details
- **Active state**: based on current pathname; highlighted item has contrasting bg/border (theme vars).
- **Tablet portrait dock**: rail starts collapsed (narrow), expand on toggle/hover; keep a11y (focusable).
- **Navigation**: use Next.js navigation; no full page reloads.
- **Scroll**: content scrolls independently of rail; overlay locks body scroll on mobile.

## Deliverables (Amp should output)
1. `components/HeaderBar.js`
2. `components/HamburgerButton.js`
3. `components/LeftMenu.js` + `components/LeftMenu.module.css`
4. `components/MobileMenu.js` + `components/MobileMenu.module.css`
5. Integration snippet for `app/layout.js` (placing rail for ≥768px, hamburger/overlay for <768px)
6. Minimal inline SVGs for hamburger/close; styled via CSS variables (no icon library).

## Acceptance Tests
- **Mobile (<768px)**:
  - Hamburger appears **top-right**; tapping opens **full-screen** menu.
  - Body cannot scroll while open; Esc/backdrop/close button all dismiss.
  - Focus moves into the menu on open and returns to hamburger on close.
  - Selecting an item closes the menu and navigates.
- **Tablet Portrait (768–1023px)**:
  - Left rail is **docked/collapsible**; toggle expands to show labels.
  - Active route is highlighted; content reflows correctly.
- **Tablet Landscape & Desktop (≥1024px)**:
  - **Persistent left rail** visible (icons + labels) like the sketch.
  - Active highlight matches current route; keyboard navigation works.
- **Theme & a11y**:
  - No hex colors in module CSS; switching `data-theme="dark"` updates colors.
  - All interactive targets ≥44px; focus rings are visible.

## Out of Scope (Phase 1)
- Notification badges, profile dropdown actions, permissions/visibility logic.
- Animations beyond basic open/close transitions.


