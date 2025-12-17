# Jira Integration - Debugging Guide

## Quick Diagnostic Steps

### 1. Check Authentication Debug Info

Visit: `http://localhost:3000/api/jira/debug`

This will show you:

- Whether you're authenticated
- If tokens exist (without exposing them)
- If environment variables are set
- Your Jira Cloud ID

**Expected Output (Authenticated):**

```json
{
  "isAuthenticated": true,
  "hasAccessToken": true,
  "hasRefreshToken": true,
  "hasCloudId": true,
  "cloudId": "abc123...",
  "accessTokenLength": 500,
  "env": {
    "hasClientId": true,
    "hasClientSecret": true,
    "hasRedirectUri": true,
    "hasNextAuthUrl": true
  }
}
```

### 2. Check Browser Console

Open browser DevTools (F12) and look for:

- Network tab: Check the actual API responses
- Console tab: Look for detailed error messages

### 3. Check Server Logs

In your terminal where `npm run dev` is running, look for:

```
Error fetching Jira tickets: ...
Jira API error: { status: ..., error: ... }
```

## Common Issues & Solutions

### Issue: "Not authenticated with Jira"

**Symptoms:**

- Error: "Not authenticated with Jira. Please login first."
- Debug endpoint shows `isAuthenticated: false`

**Solutions:**

1. Click "Connect to Jira" button
2. Check if cookies are enabled in your browser
3. Verify environment variables are set correctly
4. Check if you completed the OAuth flow

**Verify:**

```bash
# Check .env.local has these set:
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
JIRA_REDIRECT_URI=http://localhost:3000/api/jira/auth/callback
NEXTAUTH_URL=http://localhost:3000
```

### Issue: "Failed to fetch Jira tickets"

**Symptoms:**

- Generic error message
- 500 status code

**Solutions:**

1. **Check Token Validity:**

   - Tokens expire after 1 hour
   - Refresh tokens last 90 days
   - Try logging out and reconnecting

2. **Check Jira Permissions:**

   - User must have access to at least one project
   - OAuth app must have correct permissions
   - User account must be active

3. **Check API Endpoint:**
   ```bash
   # Test manually with curl:
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.atlassian.com/ex/jira/YOUR_CLOUD_ID/rest/api/3/search?jql=order+by+updated+DESC"
   ```

### Issue: "Token exchange failed"

**Symptoms:**

- Redirected back with `?error=token_exchange_failed`
- Can't complete OAuth flow

**Solutions:**

1. Verify `JIRA_CLIENT_SECRET` is correct
2. Check redirect URI matches exactly in OAuth app settings
3. Ensure OAuth app is not suspended or disabled
4. Check Atlassian Developer Console for app status

### Issue: "Invalid state"

**Symptoms:**

- Error: `?error=invalid_state`
- CSRF validation fails

**Solutions:**

1. Clear browser cookies
2. Try in incognito/private mode
3. Check if `SameSite` cookie policy is blocking cookies
4. Verify your domain/localhost is not blocking cookies

### Issue: No projects or tickets showing

**Symptoms:**

- Successfully authenticated
- But no data appears

**Solutions:**

1. **Check Jira Access:**

   - Log into Jira directly and verify you can see projects
   - Check if your user has "Browse Projects" permission

2. **Check Filters:**

   - Change "My Tickets" to "All Tickets"
   - Select "All Projects" in project filter
   - Clear status filter

3. **Check JQL Query:**
   - Server logs will show the JQL query used
   - Verify it's valid for your Jira instance

### Issue: "Jira API error: 401"

**Symptoms:**

- Getting 401 even after login
- Token seems invalid immediately

**Solutions:**

1. **Check Token Refresh:**
   - Should auto-refresh, but might fail
   - Try logging out and back in
2. **Check OAuth App:**

   - Verify app has `offline_access` permission
   - Check if app was revoked in Jira settings

3. **Clear All Cookies:**
   ```javascript
   // In browser console:
   document.cookie.split(";").forEach((c) => {
     document.cookie = c
       .replace(/^ +/, "")
       .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```

### Issue: "Jira API error: 403"

**Symptoms:**

- Forbidden error
- Can't access certain resources

**Solutions:**

1. **Check Permissions:**

   - User needs project permissions in Jira
   - OAuth app might not have requested permission scopes

2. **Re-authorize:**
   - Log out
   - Delete OAuth app authorization in Jira
   - Log in again with fresh consent

### Issue: CORS Errors

**Symptoms:**

- "CORS policy" error in console
- Network requests blocked

**Solutions:**

1. This shouldn't happen as all API calls go through your backend
2. If seeing CORS errors, check you're not calling Jira API directly from frontend
3. All Jira calls should go through `/api/jira/*` routes

## Manual Testing

### Test Authentication Flow

```javascript
// 1. Check status
fetch("/api/jira/auth/status")
  .then((r) => r.json())
  .then(console.log);

// 2. If not authenticated, login
window.location.href = "/api/jira/auth/login";

// 3. After redirect, check status again
fetch("/api/jira/auth/status")
  .then((r) => r.json())
  .then(console.log);
```

### Test Ticket Fetching

```javascript
// Fetch all tickets
fetch("/api/jira/tickets")
  .then((r) => r.json())
  .then(console.log);

// Fetch with filters
fetch("/api/jira/tickets?assignee=currentUser()")
  .then((r) => r.json())
  .then(console.log);

// Fetch specific ticket
fetch("/api/jira/tickets/PROJ-123")
  .then((r) => r.json())
  .then(console.log);
```

### Test Projects

```javascript
fetch("/api/jira/projects")
  .then((r) => r.json())
  .then(console.log);
```

## Environment Variables Checklist

Create/verify your `.env.local`:

```env
# Required - Get from Atlassian Developer Console
JIRA_CLIENT_ID=your_actual_client_id
JIRA_CLIENT_SECRET=your_actual_client_secret

# Must match OAuth app callback URL exactly
JIRA_REDIRECT_URI=http://localhost:3000/api/jira/auth/callback

# Required for URL generation
NEXTAUTH_URL=http://localhost:3000

# Don't set NODE_ENV=production in development
NODE_ENV=development
```

**Restart your dev server after changing .env.local!**

```bash
# Stop (Ctrl+C) and restart
npm run dev
```

## Getting More Help

If still having issues:

1. **Check full error in terminal** - Most detailed info appears here
2. **Check browser Network tab** - See actual API responses
3. **Try the debug endpoint** - `/api/jira/debug`
4. **Test with curl** - Isolate if it's a frontend or backend issue
5. **Check Atlassian status** - https://status.atlassian.com/

## Enable Verbose Logging

Temporarily add console.logs for debugging:

```javascript
// In lib/jiraAuth.js - jiraFetch function
console.log("Making Jira request to:", url);
console.log("With auth:", { hasToken: !!accessToken, cloudId });

// In app/jira/page.js - loadTickets
console.log("Fetching tickets with filters:", filters);
console.log("API Response:", await response.text());
```

## Reset Everything

If all else fails:

1. **Clear browser cookies** (all of them)
2. **Delete tokens in Atlassian:**
   - Go to https://id.atlassian.com/manage-profile/security/connected-apps
   - Revoke "AI90Days Integration"
3. **Restart dev server**
4. **Start fresh** - Connect to Jira again

---

**Still stuck?** Check the server logs - they contain the most detailed error information!
