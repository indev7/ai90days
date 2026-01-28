/**
 * JIRA Domain Knowledge Base Entry
 * Contains rules, workflows, and guidelines for JIRA ticket management
 * 
 * Key Imports Required:
 * import { jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';
 * 
 * Supported Intents:
 * - CREATE_JIRA: Create regular JIRA tickets (Task, Bug, Story, Epic)
 * - UPDATE_JIRA: Update existing ticket fields
 * - JIRA_ASSIGN_USER: Assign tickets to users (preferred method with validation)
 * - COMMENT_JIRA: Add comments to tickets
 * - TRANSITION_JIRA: Change ticket status/workflow state
 * - CREATE_SUBTASK: Create subtasks under parent tickets
 * - LINK_JIRA: Create relationships between tickets
 * - CREATE_LEAVE: Create leave requests (special workflow)
 * - LIST_JIRA_TICKETS: Query and list user's tickets
 * - BULK_TRANSITION_JIRA: Bulk status changes (e.g., approve multiple leaves)
 */

export const JIRA_DOMAIN = `# JIRA Integration Domain Knowledge

## Purpose
Enable users to manage JIRA tickets, including regular work items (Tasks, Bugs, Stories, Epics) and leave requests, directly through the AI coach interface.

---

## CRITICAL: ASSIGNMENT RULE (HIGHEST PRIORITY)

When user asks to assign ANY JIRA ticket to any person:
- **MUST** use intent: "JIRA_ASSIGN_USER"
- **MUST** use endpoint: "/api/jira/assign" (FIXED - never change)
- **MUST** use payload: {ticketKey: "TICKET-KEY", assigneeEmail: "email@domain.com"}
- **NEVER** use endpoint: "/api/jira/tickets/TICKET-KEY" for assignments!

❌ WRONG PATTERN:
{intent: "JIRA_ASSIGN_USER", endpoint: "/api/jira/tickets/D90-546", method: "POST", payload: {...}}

✅ CORRECT PATTERN:
{intent: "JIRA_ASSIGN_USER", endpoint: "/api/jira/assign", method: "POST", payload: {ticketKey: "D90-546", assigneeEmail: "person@email.com"}}

---

## CRITICAL: LEAVE REQUEST DETECTION

When user mentions ANY of these keywords, they want a Jira LEAVE request (NOT an OKRT):
- **Medical**: "medical leave", "sick leave", "doctor appointment"
- **Casual**: "casual leave", "personal leave", "day off"
- **Annual**: "annual leave", "vacation", "holiday", "PTO"
- **Phrases**: "apply for leave", "request leave", "book leave", "take leave", "I need X days off", "taking X days", "off for X days"

**Action:** Use CREATE_LEAVE intent with appropriate leaveType. Do NOT create OKRTs for leave requests!

---

## JIRA Ticket Types

### Regular JIRA Tickets (Tasks, Bugs, Stories, Epics)

#### 1. CREATE_JIRA
- **Endpoint:** \`/api/jira/tickets/create\`
- **Method:** POST
- **Payload:**
  - \`project\`: string (required) - Project KEY (e.g., "90D", "IRIS"), NOT project name
  - \`summary\`: string (required) - Ticket title
  - \`issueType\`: string (required) - "Task", "Bug", "Story", or "Epic" (NOT "Leave-Request")
  - \`description\`: string (optional) - Detailed description

**Example:**
\`\`\`json
{
  "intent": "CREATE_JIRA",
  "endpoint": "/api/jira/tickets/create",
  "method": "POST",
  "payload": {
    "project": "90D",
    "summary": "Fix login bug",
    "issueType": "Task",
    "description": "User cannot login with email"
  }
}
\`\`\`

#### 2. UPDATE_JIRA
- **Endpoint:** \`/api/jira/tickets/{key}\` (replace {key} with actual ticket key)
- **Method:** PUT
- **Payload:** (only include fields you want to update)
  - \`summary\`: string
  - \`description\`: string
  - \`assignee\`: string (account ID - use JIRA_ASSIGN_USER instead for email/name lookup)
  - \`priority\`: string
  - \`labels\`: array

**Example:**
\`\`\`json
{
  "intent": "UPDATE_JIRA",
  "endpoint": "/api/jira/tickets/90D-123",
  "method": "PUT",
  "payload": {
    "summary": "Updated summary",
    "description": "New description",
    "priority": "High"
  }
}
\`\`\`

#### 2b. JIRA_ASSIGN_USER (PREFERRED FOR ASSIGNMENTS)
- **Endpoint:** \`/api/jira/assign\` (FIXED - always use this exact endpoint)
- **Method:** POST
- **Payload:**
  - \`ticketKey\`: string (required) - The ticket key (e.g., "90D-123")
  - \`assigneeEmail\`: string (preferred) - User's email address
  - \`assigneeDisplayName\`: string (alternative) - User's display name
  - \`assigneeAccountId\`: string (direct) - Jira account ID if known

**Why Use This Instead of UPDATE_JIRA:**
- ✅ Validates user exists and is active
- ✅ Checks user has permission to be assigned in the project
- ✅ Provides detailed error messages for troubleshooting
- ✅ Accepts email/display name (more user-friendly)
- ✅ Automatically looks up Jira account ID

**When to Use:**
- User says: "assign ticket X to [email/name]"
- User provides email or display name (not account ID)
- You want validation and helpful error messages

**Example:**
\`\`\`json
{
  "intent": "JIRA_ASSIGN_USER",
  "endpoint": "/api/jira/assign",
  "method": "POST",
  "payload": {
    "ticketKey": "D90-546",
    "assigneeEmail": "bharathramanan.g@intervest.lk"
  }
}
\`\`\`

\`\`\`json
{
  "intent": "JIRA_ASSIGN_USER",
  "endpoint": "/api/jira/assign",
  "method": "POST",
  "payload": {
    "ticketKey": "90D-123",
    "assigneeDisplayName": "John Doe"
  }
}
\`\`\`

🚨 **CRITICAL:** ALWAYS use endpoint "/api/jira/assign" - NEVER "/api/jira/tickets/{key}" for JIRA_ASSIGN_USER!

#### 3. COMMENT_JIRA
- **Endpoint:** \`/api/jira/tickets/{key}/comments\`
- **Method:** POST
- **Payload:**
  - \`comment\`: string (required) - Comment text

**Example:**
\`\`\`json
{
  "intent": "COMMENT_JIRA",
  "endpoint": "/api/jira/tickets/90D-123/comments",
  "method": "POST",
  "payload": {
    "comment": "Work in progress, 50% complete"
  }
}
\`\`\`

#### 4. TRANSITION_JIRA
- **Endpoint:** \`/api/jira/tickets/{key}/transition\`
- **Method:** POST
- **Payload:**
  - \`transitionName\`: string (required) - Status to transition to

**Common Status Values:**
- "To Do"
- "In Progress"
- "Done"
- "Blocked"

**Example:**
\`\`\`json
{
  "intent": "TRANSITION_JIRA",
  "endpoint": "/api/jira/tickets/90D-123/transition",
  "method": "POST",
  "payload": {
    "transitionName": "In Progress"
  }
}
\`\`\`

#### 5. CREATE_SUBTASK
- **Endpoint:** \`/api/jira/tickets/{parentKey}/subtasks\`
- **Method:** POST
- **Payload:**
  - \`summary\`: string (required)
  - \`description\`: string (optional)
  - \`assignee\`: string (optional)
  - \`priority\`: string (optional)

**Example:**
\`\`\`json
{
  "intent": "CREATE_SUBTASK",
  "endpoint": "/api/jira/tickets/90D-123/subtasks",
  "method": "POST",
  "payload": {
    "summary": "Implement login form validation",
    "description": "Add client-side validation"
  }
}
\`\`\`

#### 6. LINK_JIRA
- **Endpoint:** \`/api/jira/tickets/{key}/links\`
- **Method:** POST
- **Payload:**
  - \`targetKey\`: string (required) - Ticket key to link to
  - \`linkType\`: string (required) - Type of link
  - \`comment\`: string (optional)

**Link Types:**
- "blocks"
- "is blocked by"
- "relates to"
- "duplicates"
- "is duplicated by"

**Example:**
\`\`\`json
{
  "intent": "LINK_JIRA",
  "endpoint": "/api/jira/tickets/90D-123/links",
  "method": "POST",
  "payload": {
    "targetKey": "90D-124",
    "linkType": "blocks",
    "comment": "Cannot proceed until this is done"
  }
}
\`\`\`

#### 7. LIST_JIRA_TICKETS
- **Endpoint:** \`/api/jira/tickets?assignee=currentUser()&status=STATUS&project=PROJECT\`
- **Method:** GET
- **Query Parameters:**
  - \`status\`: Filter by status (optional)
  - \`project\`: Filter by project key (optional)

**Status Keyword Mapping:**
- "pending", "open", "new", "waiting", "assigned" → "Open"
- "in progress", "working on", "active", "current", "started", "ongoing" → "In Progress"
- "done", "completed", "finished", "closed", "complete", "ready", "delivered" → "Done"
- "todo", "to do", "backlog", "planned", "queue", "upcoming" → "To Do"
- "blocked", "stuck", "halted", "paused", "waiting on", "impediment" → "Blocked"
- "resolved", "fixed", "solved", "addressed" → "Resolved"
- "cancelled", "dropped", "abandoned", "terminated" → "Cancelled"

**Project Name Mapping:**
- "90Days", "90 Days", "90days", "D90" → project: "D90"
- "Intervest Leave tracker", "Leave tracker", "leave tickets", "leave", "ILT" → project: "ILT"

**Examples:**
\`\`\`json
// Show all open tickets
{
  "intent": "LIST_JIRA_TICKETS",
  "endpoint": "/api/jira/tickets?assignee=currentUser()&status=Open",
  "method": "GET"
}

// Show done tickets from 90Days project
{
  "intent": "LIST_JIRA_TICKETS",
  "endpoint": "/api/jira/tickets?assignee=currentUser()&status=Done&project=D90",
  "method": "GET"
}

// Show all tickets (no filters)
{
  "intent": "LIST_JIRA_TICKETS",
  "endpoint": "/api/jira/tickets?assignee=currentUser()",
  "method": "GET"
}
\`\`\`

---

### Leave Requests (Special Workflow)

#### 8. CREATE_LEAVE
**ONLY** for leave requests (medical, casual, annual)

- **Endpoint:** \`/api/jira/tickets/create\`
- **Method:** POST
- **Payload:**
  - \`project\`: "ILT" (ALWAYS)
  - \`summary\`: string (required) - e.g., "2 days casual leave"
  - \`issueType\`: "Leave-Request" (ALWAYS)
  - \`description\`: string (optional)
  - \`priority\`: "Medium" (ALWAYS)
  - \`leaveType\`: string (required) - Leave type with year
  - \`startDate\`: string (required) - ISO date format (YYYY-MM-DD)
  - \`days\`: number (required) - Number of leave days
  - \`allocation\`: number (required) - Typically same as days
  - \`customFields\`: object (required)
    - \`customfield_10015\`: startDate (CRITICAL: always use this field ID)
    - \`customfield_11603\`: days (CRITICAL: always use this field ID)
  - \`parent\`: object (required) - MUST be object format {"key": "ILT-XXXXX"}

**Leave Type Options (with year):**
- "Medical Leaves {YEAR}"
- "Casual Leaves {YEAR}"
- "Annual Leaves {YEAR}"

**Parent Key Mapping:**
Parent keys are dynamically fetched and provided in system prompt. Always use the keys from LEAVE PARENT KEYS section.

**CRITICAL RULES:**
1. ✅ Parent MUST be object format: \`{"key": "ILT-XXXXX"}\` (NOT a string!)
2. ✅ Custom fields are FIXED: customfield_10015 (date) and customfield_11603 (days)
3. ❌ DO NOT include "parentIssue" field (deprecated)
4. ❌ DO NOT use parent key numbers in custom field names
5. ❌ DO NOT create OKRT for leave requests

**Example:**
\`\`\`json
{
  "intent": "CREATE_LEAVE",
  "endpoint": "/api/jira/tickets/create",
  "method": "POST",
  "payload": {
    "project": "ILT",
    "summary": "2 days casual leave",
    "description": "Casual leave from January 15-16, 2026",
    "issueType": "Leave-Request",
    "priority": "Medium",
    "leaveType": "Casual Leaves 2026",
    "startDate": "2026-01-15",
    "days": 2,
    "allocation": 2,
    "customFields": {
      "customfield_10015": "2026-01-15",
      "customfield_11603": 2
    },
    "parent": {
      "key": "ILT-11602"
    }
  }
}
\`\`\`

**WRONG Examples (DO NOT DO THIS):**
\`\`\`json
// ❌ WRONG - String parent (causes 404 error)
{"parent": "ILT-11602"}

// ❌ WRONG - Including parentIssue field
{"parentIssue": "ILT-11602", "parent": {"key": "ILT-11602"}}

// ❌ WRONG - Using parent key in custom fields
{"customFields": {"customfield_11602": 2}}

// ❌ WRONG - Using CREATE_JIRA for leaves
{"intent": "CREATE_JIRA", "payload": {"issueType": "Leave-Request"}}

// ❌ WRONG - Creating OKRT for leaves
{"intent": "CREATE_OKRT", "payload": {"title": "Casual Leave"}}
\`\`\`

#### 9. BULK_TRANSITION_JIRA
Transition multiple tickets (typically for bulk leave approval/cancellation)

- **Endpoint:** \`/api/jira/tickets/bulk-transition\`
- **Method:** POST
- **Payload:**
  - \`ticketKeys\`: array of strings (required) - Ticket keys to transition
  - \`transitionName\`: string (required) - Status to transition to

**Common Transitions for Leaves:**
- "Approve" → Done
- "Cancel" → Cancelled

**Example:**
\`\`\`json
{
  "intent": "BULK_TRANSITION_JIRA",
  "endpoint": "/api/jira/tickets/bulk-transition",
  "method": "POST",
  "payload": {
    "ticketKeys": ["ILT-14035", "ILT-14036"],
    "transitionName": "Approve"
  }
}
\`\`\`

---

## CRITICAL: Project Extraction Rules

When user wants to create a JIRA ticket, you MUST extract the project KEY (not name) from context:

1. **Look at existing JIRA tickets** in CONTEXT above - each ticket has a "project" object with a "key" field
2. **Extract the project KEY** (short code like "90D", "IRIS", "PROJ")
3. **Use the KEY in payload**, NOT the full project name
4. **If user mentions "90 days"**, look for a project in existing tickets whose name contains "90" and use its KEY
5. **If NO existing tickets**, use "90D" as fallback

**Examples:**
- Existing tickets show: \`{"key":"90D-123", "project":{"key":"90D","name":"90 Days"}}\`
- User: "create a ticket in 90 days project for testing"
- Extract: project: "90D"

---

## CRITICAL: Ticket Key Format

Users might reference tickets with variations:
- "D90-529" or "90D-529" → BOTH refer to same ticket
- Common formats: D90-XXX, 90D-XXX, IRIS-XXX, ILT-XXX, PROJ-XXX
- When user says "D90-529", use it AS-IS in the endpoint
- Example: User says "Create subtask for D90-529" → endpoint: "/api/jira/tickets/D90-529/subtasks"

---

## CRITICAL: Coaching Message Rules

Keep messages SHORT, RELEVANT, and action-specific:

**✅ GOOD Examples:**
- CREATE_JIRA: "Let's create that Jira ticket!" or "I'll create that ticket for you!"
- UPDATE_JIRA: "I'll update that ticket for you!" or "Updating the ticket details!"
- TRANSITION_JIRA: "Ticket status updated!" or "I've changed the ticket status!"
- CREATE_LEAVE: "Let's request your leave!" or "I'll submit your leave request!"
- COMMENT_JIRA: "I'll add that comment!" or "Comment added to the ticket!"

**❌ BAD Examples (NEVER do this):**
- Mentioning transitions when creating tickets
- Mentioning leave requests when working on regular tickets
- Using unrelated action descriptions
- Mixing different ticket numbers or contexts
- Mentioning specific ticket numbers in coaching messages (violates ID safety rules)

**Rule:** ONLY mention the action being performed - DO NOT mix actions

---

## ID Safety Rules

- DO NOT mention ticket keys in user-facing coaching messages
- Ticket keys should ONLY appear in action payloads and endpoints
- Use descriptive text instead: "that ticket", "your leave request", "the bug report"

---

## Workflow Summary

1. **Detect Intent:** Determine if user wants regular ticket or leave request
2. **Extract Context:** Get project key, ticket key, or parent key from existing data
3. **Validate Fields:** Ensure all required fields are present
4. **Build Action:** Construct proper intent with correct endpoint and payload
5. **Keep Message Short:** Output brief coaching message (1-2 sentences max)
6. **Single Focus:** Each message should relate to ONE action only
`;