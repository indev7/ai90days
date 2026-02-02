# Microsoft Outlook Mail (Graph) Domain

This knowledge enables AIME to read a signed-in user's Outlook inbox via Microsoft Graph using delegated access. Use metadata-first, lazy-loading patterns. Do not fetch message bodies unless explicitly requested.

## Scope and Consent
- Required delegated scope: `Mail.ReadBasic` (least privilege).
- If Graph returns 401/403, prompt user to re-login and grant consent.
- Error messages:
  - 401: "Microsoft consent required for Mail.ReadBasic; please re-login."
  - 403: "Admin consent may be required in this tenant."

## Endpoints
### 1) List Messages (metadata-only, paged)
`GET /api/ms/mail/messages`
Query params:
- `folder=inbox` (default: Inbox)
- `top=25` (default, max 50)
- `cursor=<opaque>` (optional; Graph @odata.nextLink)
- `unreadOnly=true|false` (optional)
- `fromDate=<ISO>` / `toDate=<ISO>` (optional filter on receivedDateTime)

Response:
```json
{
  "rows": [
    {
      "id": "...",
      "subject": "...",
      "fromName": "...",
      "fromEmail": "...",
      "receivedDateTime": "2024-01-01T12:34:56Z",
      "isRead": false,
      "hasAttachments": false,
      "importance": "normal",
      "webLink": "..."
    }
  ],
  "cursor": "<@odata.nextLink or null>"
}
```

### 2) Get Message Preview (lightweight)
`GET /api/ms/mail/message/:id/preview`
Response:
```json
{
  "id": "...",
  "subject": "...",
  "fromName": "...",
  "fromEmail": "...",
  "receivedDateTime": "2024-01-01T12:34:56Z",
  "isRead": false,
  "bodyPreview": "...",
  "webLink": "..."
}
```

### 3) Open in Outlook (redirect proxy)
`GET /api/ms/mail/message/:id/open`
- Returns HTTP 302 redirect to Outlook web link.

## UI Guidance
When a user asks about new email today, call the list endpoint with `fromDate` at the start of today. Render a table: From | Subject | Received | Link. For the link, use `webLink` or the internal open endpoint.

## Safety
- Never log or display message bodies for list calls.
- Log only minimal telemetry: endpoint, count, timestamp, userId.
- Always use delegated access for the current signed-in user.
