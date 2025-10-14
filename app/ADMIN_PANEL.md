# Admin Panel Implementation

## Status: ✅ IMPLEMENTED

This document describes the secure Admin Panel that has been implemented inside the existing Next.js `app/` directory. The admin panel provides a protected interface for viewing all system users, secured by a password set via environment variable.

Goals
- Restrict access to an "Admin" UI under `/admin` to only users who know a shared server-side secret called `ADMIN_PW` set in the environment.
- Provide a login interface at `/admin/login` that asks for the admin password.
- Store an authenticated admin flag in a secure, short-lived cookie or in-memory server session.
- Provide a server-side API `/api/admin/users` that lists system users (only accessible when admin-authenticated).
- Keep all server-side logic on Vercel (do not try to run server APIs inside Capacitor mobile static builds).

Security contract (simple)
- Input: admin password from the login form.
- Output: an authentication cookie `admin_auth` (HTTPOnly, Secure, SameSite=Lax) set when password matches environment variable `ADMIN_PW`.
- Error modes: invalid password returns 401 and does not set cookie. Missing `ADMIN_PW` environment variable disables admin panel until configured.

Important environment variable
- `ADMIN_PW` (server only) — a strong secret used to validate admin login. Do NOT commit it in the repo. For local dev set in `.env.local` or Vercel project settings.

High-level flow
1. Admin navigates to `/admin/login` and submits password.
2. The client POSTs the password to `/api/admin/login` (server API route in `app/api/admin/login/route.js`).
3. Server checks `process.env.ADMIN_PW`. If they match, server sets a secure HTTP-only cookie `admin_auth` with a short TTL (e.g. 1 hour) and returns 200.
4. Client redirects to `/admin` where the server or client checks auth by calling `/api/admin/me` or by reading a signed cookie server-side.
5. Admin can open `/admin/users` or `/admin` UI that fetches `/api/admin/users` to get the system user list. The API route enforces admin cookie.

## Implemented Files

The following files have been created and integrated into the project:

### 1) Admin Authentication Helper: `lib/adminAuth.js`

✅ **Implemented** with cookie-based authentication and password verification functions.

### 2) Login API Route: `app/api/admin/login/route.js`

✅ **Implemented** with secure HTTP-only cookie handling and 1-hour session TTL.

### 3) Logout API Route: `app/api/admin/logout/route.js`

✅ **Implemented** to clear admin session cookie.

### 4) Protected Users API: `app/api/admin/users/route.js`

✅ **Implemented** with authentication check and integration with `getAllUsers()` from `lib/db.js`.

### 5) Database Helper: `getAllUsers()` in `lib/db.js`

✅ **Implemented** - Added new function to fetch all users from the database with relevant fields.

### 6) Admin Login Page: `app/admin/login/page.jsx`

✅ **Implemented** with styled UI (`AdminLogin.module.css`), form validation, error handling, and loading states.

### 7) Admin Dashboard Page: `app/admin/page.jsx`

✅ **Implemented** as a client component with styled UI (`AdminDashboard.module.css`), displaying users in a table format with:
- User statistics
- Comprehensive user table with ID, name, email, profile picture, Microsoft ID status, and creation date
- Logout functionality
- Responsive design
- Auto-redirect to login if unauthenticated

### 8) Environment Variable Example: `.env.local.example`

✅ **Created** to document the required `ADMIN_PW` variable.

CORS and mobile
- If you wrap the UI in Capacitor or load the static app from a file origin, avoid relying on cookie-based auth. Prefer token-based auth when the mobile client will be a static bundle.
- If continuing to use HTTP-only cookies for admin auth, ensure the mobile WebView can load the site from your canonical domain (Option A from previous analysis). Cookie-based admin session requires requests to be made to the same domain.

Security considerations
- Avoid storing `ADMIN_PW` in client-accessible variables. Never set it in `NEXT_PUBLIC_*` or any client bundle.
- Prefer stronger authentication for production: user accounts with roles, OAuth2, or NextAuth with role checks.
- If you must use a shared `ADMIN_PW`, rotate it regularly and store it in your platform secret manager (Vercel Environment Variables, or .env.local for dev).

## Setup Instructions

### 1. Set Environment Variable

Create a `.env.local` file in the project root (if it doesn't exist) and add:

```bash
ADMIN_PW=your_secure_admin_password_here
```

**Important:** Choose a strong password and keep it secure. Do not commit this file to version control.

### 2. Restart Development Server

After setting the environment variable, restart your Next.js development server:

```bash
npm run dev
```

### 3. Access Admin Panel

- Navigate to `/admin/login` in your browser
- Enter the password you set in `ADMIN_PW`
- Upon successful login, you'll be redirected to `/admin` dashboard
- The dashboard displays all system users with their details

### 4. Production Deployment

For production on Vercel:
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `ADMIN_PW` with your secure password
4. Redeploy your application

## Features Implemented

✅ **Secure Authentication**
- Password-based admin access via `ADMIN_PW` environment variable
- HTTP-only secure cookies for session management
- 1-hour session timeout
- Auto-redirect to login for unauthorized access

✅ **Admin Login Interface**
- Clean, modern UI with gradient design
- Form validation and error handling
- Loading states during authentication
- Responsive design for mobile and desktop

✅ **Admin Dashboard**
- View all system users in a sortable table
- Display user details: ID, display name, email, names, Microsoft ID status, creation date
- User profile pictures displayed in table
- Total user count statistics
- Logout functionality
- Responsive table with mobile optimization

✅ **Protected API Routes**
- `/api/admin/login` - Authenticate admin
- `/api/admin/logout` - Clear admin session
- `/api/admin/users` - Fetch all users (protected)

✅ **Database Integration**
- New `getAllUsers()` function in `lib/db.js`
- Fetches comprehensive user data from SQLite database

## Security Considerations

- ✅ Password never stored in client-side code
- ✅ HTTP-only cookies prevent XSS attacks
- ✅ Secure flag enabled in production
- ✅ SameSite protection against CSRF
- ✅ Session timeout (1 hour)
- ✅ No exposed admin credentials in version control

## File Structure

```
app/
  admin/
    login/
      page.jsx                    # Admin login page
      AdminLogin.module.css       # Login page styles
    page.jsx                      # Admin dashboard
    AdminDashboard.module.css     # Dashboard styles
  api/
    admin/
      login/
        route.js                  # Login API endpoint
      logout/
        route.js                  # Logout API endpoint
      users/
        route.js                  # Protected users API
lib/
  adminAuth.js                    # Authentication helper functions
  db.js                           # Database (updated with getAllUsers)
.env.local.example                # Environment variable template
app/ADMIN_PANEL.md               # This documentation file
```

## Requirements Coverage

✅ **Add `ADMIN_PW` env var** - Implemented and documented  
✅ **Admin login interface** - Full UI with validation and error handling  
✅ **Middleware/API protection** - Cookie-based authentication on all admin routes  
✅ **View all system users** - Comprehensive dashboard with user table  
✅ **No separate project** - All code integrated into existing `app/` directory  
✅ **Security** - HTTP-only cookies, secure flags, session timeout

