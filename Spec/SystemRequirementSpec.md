# System Requirement Spec (Role-Based)

## Scope & Assumptions
- Roles handled in code: `User` (default) and `Admin`. `Owner`/`Leader` are present in guards but not detailed here. Source: `app/api/me/route.js`.
- Auth required for all app routes except login/signup; sessions via custom JWT or NextAuth (Azure AD). Azure AD login restricted to `intervest.lk` and `staysure.co.uk` domains (`app/api/auth/[...nextauth]/route.js`).
- Navigation and layout come from `components/LeftMenu.js` and `app/layout.js`; the “Members” link only appears for Admin users.

## User (least privilege)

### Authentication & Session
- Sign in with email/password (`/api/login` from `app/login/page.js`) or Microsoft OAuth (`signIn('azure-ad')`).
- On success, redirect to `/home`, then to preferred landing (`dashboard`, `shared`, or `business`) based on saved preferences (`app/home/page.js`).

### Available UIs & Capabilities
- **Dashboard (`/dashboard`)**: 12-week clock, Today widget, notifications, OKRT modal trigger, progressive data from main tree (`app/dashboard/page.js`).
- **My OKRs (`/okrt`)**: Create/edit Objectives, Key Results, Tasks (via `OKRTModal`), share objectives (`ShareModal`), view/comment threads (`CommentsSection`). Data bound to user’s own OKRTs (`app/okrt/page.js`).
- **Shared OKRs (`/shared`, `/shared/[id]`)**: Browse shared objectives, follow/unfollow (`/api/follow`), view hierarchy and detail pages with KR/task breakdown and comments (`app/shared/page.js`, `app/shared/[id]/page.js`).
- **Business / Organisation (`/organisation`)**: Strategy view (`StrategyHouse`); group org-chart with popover details for objectives/members (`GroupsView.js`); add/edit group modal for signed-in users. Creation allowed for non-Organisation types; creator becomes group admin (`app/organisation/page.js`, `app/api/groups/route.js`). Group edits/deletes only when the user is an admin of that group (`app/api/groups/[id]/route.js`).
- **Calendar / Schedule (`/calendar`)**: Weekly planner for tasks/time blocks; create/update/delete scheduled blocks and edit linked tasks (`app/calendar/page.js`).
- **Notifications (`/notifications`)**: SSE feed, mark read/all-read, delete items (`app/notifications/page.js`).
- **Coach (`/coach`)**: Chat with AI coach, optional text-to-speech and voice input, quick action execution against OKR data (`app/coach/page.js`).
- **Profile (`/profile`)**: Update first/last name, password (requires current password), view email (`app/profile/page.js`).
- **Settings (`/settings`)**: Choose theme, preferred TTS voice, default home page (`app/settings/page.js`).
- **Navigation helpers**: Quick objective/task creation and group creation actions in left menu; unread notification badge in menu (`components/LeftMenu.js`).

### Data/Access Constraints
- User search limited to partial search (>1 char) returning safe fields only; no role/email update rights (`app/api/users/route.js` without `all=true`).
- Group membership management only when the user is admin for that specific group (add/remove members, toggle admin flag) via `/api/groups/:id/members` endpoints.
- Cannot access member admin UI or `all` user listing.

## Admin

### Additional UIs & Capabilities
- **Members admin (`/members`)**: View all users; edit display/first/last name, email, and role (User/Leader/Owner/Admin). Backend enforced by `app/api/users/route.js` (`all=true`) and `app/api/users/[id]/route.js`. Frontend gate redirects non-admins to dashboard (`app/members/page.js`).
- **Organisation-level control**:
  - Only Admin can create a group of type `Organisation` and can change a group’s type to `Organisation` (only one allowed) (`app/api/groups/route.js`, `app/api/groups/[id]/route.js`).
  - Admins can edit Organisation groups (still must be group admin on that group) and are included in PUT guardrails for other group types.
- **All User capabilities** remain available.

### Data/Access Constraints
- Members page and `/api/users` admin endpoints require `user.role === 'Admin'`.
- Group edit/delete still requires admin status on the specific group; delete blocked if child groups exist.

## Out of Scope (present in code but not covered here)
- Roles `Owner` and `Leader` (guardrails present in group APIs).
- Any external integrations beyond Microsoft OAuth (e.g., calendar providers) and detailed “coach action” definitions.
