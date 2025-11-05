# Microsoft Calendar Integration Summary

## Overview
Successfully integrated Microsoft Calendar with the 90days app. The calendar node is now part of the mainTree structure and fetches events from the current quarter.

## Changes Made

### 1. Updated Microsoft OAuth Scopes
**File:** `app/api/auth/[...nextauth]/route.js`
- Added `Calendars.Read` and `offline_access` scopes to the Azure AD provider
- Updated to store access tokens, refresh tokens, and token expiration times in the database
- Tokens are automatically refreshed when expired

### 2. Database Migration
**Files:** 
- `Phase1/PGDB/migrate-calendar-tokens.sql`
- `scripts/migrateCalendarTokens.js`

Added three new columns to the `users` table:
- `microsoft_access_token` (TEXT) - Stores the OAuth access token
- `microsoft_refresh_token` (TEXT) - Stores the refresh token for token renewal
- `microsoft_token_expires_at` (TIMESTAMPTZ) - Tracks when the token expires

### 3. MainTree Integration
**File:** `lib/mainTreeLoader.js`

Added `fetchCalendarEvents()` function that:
- Fetches calendar events from Microsoft Graph API
- Automatically refreshes expired tokens
- Filters events for the current quarter only
- Returns only essential fields: title, startTime, endTime, timeZone
- Includes debug logging with emoji indicators (🗓️, ✅, ❌)

The calendar node structure in mainTree:
```javascript
{
  calendar: {
    events: [
      {
        title: "Event Title",
        startTime: "2025-01-15T10:00:00",
        endTime: "2025-01-15T11:00:00",
        timeZone: "UTC"
      }
    ],
    quarter: {
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-03-31T23:59:59.000Z"
    }
  }
}
```

### 4. Calendar API Route
**File:** `app/api/calendar/route.js`

Created a dedicated API endpoint (`/api/calendar`) for on-demand calendar fetching:
- GET request returns current quarter's calendar events
- Handles token refresh automatically
- Includes comprehensive debug logging
- Returns events with quarter date range

## Debug Logging

All calendar operations include console logging with emoji indicators:
- 🗓️ - Fetching calendar events
- ✅ - Successful operations
- ❌ - Errors or failures
- 🔄 - Token refresh operations

Example log output:
```
[MainTreeLoader] 🗓️  Fetching Microsoft Calendar events from 2025-01-01 to 2025-03-31
[MainTreeLoader] ✅ Successfully fetched 15 calendar events from Microsoft Graph API
```

## Azure AD Configuration Required

Ensure the following permissions are granted in Azure AD App Registration:
1. `User.Read` - Read user profile
2. `Calendars.Read` - Read user calendars
3. `offline_access` - Maintain access to data

## Testing

To test the integration:
1. Sign in with Microsoft account
2. The calendar events will be automatically fetched and included in mainTree
3. Check browser console for debug messages
4. Access `/api/calendar` endpoint to fetch calendar data on-demand

## Next Steps

The calendar data is now available in the mainTree and can be:
- Displayed in the calendar page
- Used for scheduling and time management features
- Integrated with OKRTs and tasks
- Shown in dashboard widgets