# 🎯 Jira Integration - Quick Start

## ✨ What's Included

A complete Jira integration with session-based OAuth authentication that allows users to:

- 🔐 Securely connect their Jira account (no database storage needed)
- 📋 View and filter their Jira tickets
- ✏️ Edit ticket details (summary, description, priority)
- 🔄 Change ticket status (workflow transitions)
- ➕ Create new Jira issues
- 🔄 Auto-refresh expired tokens

## 🚀 Quick Setup (5 minutes)

### 1. Create Jira OAuth App

1. Go to https://developer.atlassian.com/console/myapps/
2. Click **"Create"** → **"OAuth 2.0 integration"**
3. Name: "AI90Days Integration" (or your choice)
4. **Callback URL**: `http://localhost:3000/api/jira/auth/callback`
5. **Permissions** (Add these):
   - `read:jira-work`
   - `write:jira-work`
   - `read:jira-user`
   - `offline_access`
6. Save and copy your **Client ID** and **Client Secret**

### 2. Add Environment Variables

Create or update `.env.local`:

```env
JIRA_CLIENT_ID=your_client_id_here
JIRA_CLIENT_SECRET=your_client_secret_here
JIRA_REDIRECT_URI=http://localhost:3000/api/jira/auth/callback
NEXTAUTH_URL=http://localhost:3000
```

### 3. Start & Test

```bash
npm run dev
```

Navigate to: http://localhost:3000/jira

Click **"Connect to Jira"** and you're done! 🎉

## 📁 What Was Created

```
app/
  api/jira/
    auth/
      ├── login/route.js          # OAuth login
      ├── callback/route.js       # OAuth callback
      ├── logout/route.js         # Disconnect
      ├── refresh/route.js        # Token refresh
      └── status/route.js         # Check auth
    tickets/
      ├── route.js                # List tickets
      ├── [ticketKey]/route.js    # Get/update ticket
      ├── [ticketKey]/transition/ # Change status
      └── create/route.js         # Create ticket
    projects/route.js             # List projects
  jira/
    ├── page.js                   # Main UI
    └── page.module.css           # Styles

lib/
  jiraAuth.js                     # Auth utilities

components/
  LeftMenu.js                     # (Updated with Jira link)
```

## 🔒 Security Features

- ✅ HTTP-only cookies (JavaScript can't access tokens)
- ✅ CSRF protection with state validation
- ✅ Secure flag in production
- ✅ SameSite cookie policy
- ✅ Auto token refresh (transparent to user)
- ✅ No database storage required

## 🎨 Features

### Authentication

- OAuth 2.0 flow (similar to VS Code GitHub auth)
- Session-based token storage in cookies
- 90-day refresh token lifetime
- Automatic reconnection on token expiry

### Ticket Management

- **View**: Browse all your tickets with filters
- **Edit**: Update summary, description, priority, labels
- **Status**: Move tickets through workflow states
- **Create**: Create new issues in any project
- **Filter**: By project, status, assignee

### UI

- Clean, modern interface
- Real-time updates
- Responsive design (mobile-friendly)
- Split view: List + Details
- Status badges with color coding

## 🔧 API Endpoints

### Authentication

- `GET /api/jira/auth/login` - Start OAuth
- `GET /api/jira/auth/callback` - Handle OAuth return
- `POST /api/jira/auth/logout` - Disconnect
- `POST /api/jira/auth/refresh` - Refresh token
- `GET /api/jira/auth/status` - Check if connected

### Tickets

- `GET /api/jira/tickets?project=KEY&status=Todo&assignee=currentUser()`
- `GET /api/jira/tickets/[KEY-123]`
- `PUT /api/jira/tickets/[KEY-123]`
- `POST /api/jira/tickets/[KEY-123]/transition`
- `POST /api/jira/tickets/create`

### Projects

- `GET /api/jira/projects`

## 🎯 Usage Examples

### In Your Components

```javascript
// Check if user is connected to Jira
const response = await fetch("/api/jira/auth/status");
const { authenticated } = await response.json();

// Get user's tickets
const tickets = await fetch("/api/jira/tickets?assignee=currentUser()");
const data = await tickets.json();

// Update a ticket
await fetch("/api/jira/tickets/PROJ-123", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    summary: "Updated summary",
    description: "Updated description",
  }),
});

// Change ticket status
await fetch("/api/jira/tickets/PROJ-123/transition", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "In Progress" }),
});
```

## 🐛 Troubleshooting

**"Authentication failed"**

- Verify Client ID/Secret are correct
- Check redirect URI matches exactly (http vs https)
- Ensure OAuth app has required permissions

**"No tickets found"**

- Verify user has access to Jira projects
- Try "All Tickets" filter
- Check permissions in Jira

**Tokens expired**

- Refresh tokens last 90 days
- User needs to reconnect after expiry
- Auto-refresh handles short-term expirations

## 📚 Documentation

Full documentation: `JIRA_INTEGRATION_GUIDE.md`

## 🌟 Next Steps

You can extend this integration:

- Add comment support
- Add attachment handling
- Integrate with your task system
- Add time tracking
- Add sprint/board views
- Add custom fields
- Add Jira webhooks for real-time updates

## 📝 Notes

- Works with **Jira Cloud only** (not Server/Data Center)
- Each user authenticates independently
- Tokens stored per browser session
- No database migration required
- Supports multiple Jira sites if user has access

---

**Need help?** Check the full guide in `JIRA_INTEGRATION_GUIDE.md`
