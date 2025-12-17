# Jira Integration Setup

This application includes a Jira integration that allows users to authenticate with their Jira account and manage tickets directly within the system.

## Features

- **OAuth 2.0 Authentication** - Secure login flow similar to VS Code's GitHub authentication
- **Session-based Token Storage** - Tokens stored in HTTP-only cookies (no database required)
- **View Tickets** - Browse and filter your Jira tickets
- **Edit Tickets** - Update ticket summary, description, priority, and more
- **Status Transitions** - Move tickets between workflow states
- **Create Tickets** - Create new Jira issues from the application
- **Auto Token Refresh** - Automatically refreshes expired tokens

## Setup Instructions

### 1. Create a Jira OAuth App

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Click "Create" → "OAuth 2.0 integration"
3. Give your app a name (e.g., "AI90Days Integration")
4. Add your callback URL: `http://localhost:3000/api/jira/auth/callback` (for development)
5. Add these permissions:
   - `read:jira-work` - Read Jira project and issue data
   - `write:jira-work` - Create and edit issues
   - `read:jira-user` - Read user information
   - `offline_access` - Refresh tokens
6. Save and note your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# Jira OAuth Configuration
JIRA_CLIENT_ID=your_client_id_here
JIRA_CLIENT_SECRET=your_client_secret_here
JIRA_REDIRECT_URI=http://localhost:3000/api/jira/auth/callback

# Required for generating full URLs
NEXTAUTH_URL=http://localhost:3000
```

For production, update `JIRA_REDIRECT_URI` and `NEXTAUTH_URL` to your production domain.

### 3. Start the Application

```bash
npm run dev
```

### 4. Connect to Jira

1. Navigate to `/jira` in your application
2. Click "Connect to Jira"
3. Authorize the application in Jira
4. You'll be redirected back and can start managing tickets!

## Usage

### Authentication Flow

The integration uses OAuth 2.0 (3-legged OAuth) flow:

1. User clicks "Connect to Jira"
2. Redirected to Atlassian authorization page
3. User grants permissions
4. Application receives authorization code
5. Code exchanged for access token and refresh token
6. Tokens stored in HTTP-only cookies

### API Endpoints

#### Authentication

- `GET /api/jira/auth/login` - Initiate OAuth flow
- `GET /api/jira/auth/callback` - OAuth callback handler
- `POST /api/jira/auth/logout` - Clear session
- `POST /api/jira/auth/refresh` - Refresh access token
- `GET /api/jira/auth/status` - Check authentication status

#### Tickets

- `GET /api/jira/tickets` - List tickets (with filters)
- `GET /api/jira/tickets/[ticketKey]` - Get ticket details
- `PUT /api/jira/tickets/[ticketKey]` - Update ticket
- `POST /api/jira/tickets/[ticketKey]/transition` - Change status
- `POST /api/jira/tickets/create` - Create new ticket

#### Projects

- `GET /api/jira/projects` - List available projects

### Security Features

- **HTTP-only cookies** - Tokens not accessible via JavaScript
- **CSRF protection** - State parameter validation
- **Secure flag** - Cookies marked secure in production
- **SameSite policy** - Prevents CSRF attacks
- **Token expiration** - Access tokens expire after 1 hour
- **Auto refresh** - Seamlessly refreshes tokens when needed

## Troubleshooting

### "Authentication failed"

- Verify your Client ID and Client Secret are correct
- Check that the redirect URI matches exactly (including http/https)
- Ensure your OAuth app has the required permissions

### "Token exchange failed"

- Check that your Client Secret is correct
- Verify the redirect URI in your OAuth app settings

### "No tickets found"

- Make sure you have access to at least one Jira project
- Try clearing filters or selecting "All Tickets"
- Check that your Jira user has permissions to view issues

### Token Refresh Issues

- The refresh token is valid for 90 days
- If expired, user needs to re-authenticate
- Check browser console for detailed error messages

## Development

### File Structure

```
app/
  api/
    jira/
      auth/
        login/route.js          # Initiate OAuth
        callback/route.js       # Handle OAuth callback
        logout/route.js         # Clear session
        refresh/route.js        # Refresh tokens
        status/route.js         # Check auth status
      tickets/
        route.js                # List tickets
        [ticketKey]/
          route.js              # Get/update ticket
          transition/route.js   # Change status
        create/route.js         # Create ticket
      projects/route.js         # List projects
  jira/
    page.js                     # Main Jira UI
    page.module.css             # Styles

lib/
  jiraAuth.js                   # Authentication utilities
```

### Customization

You can customize the integration by:

- Adding more Jira API endpoints
- Customizing the UI theme
- Adding additional filters
- Implementing comment support
- Adding attachment handling
- Integrating with your task system

## Notes

- Tokens are stored per browser session
- Each user authenticates independently
- No database migration required
- Works with Jira Cloud only (not Server/Data Center)
- Supports multiple Jira sites if user has access
