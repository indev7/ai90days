export const JIRA_INITIATIVE_DOMAIN = `{
  "type": "object",
  "title": "Initiative",
  "description": "Jira Portfolio Management Initiative issue type",
  "mainTreeNote": "Initiatives may be available in mainTree.initiatives. Prefer using mainTree data when present before requesting Jira reads.",
  "xJqlGuidance": {
    "rules": [
      "For custom Jira fields, use the exact Jira field display name in double quotes inside JQL.",
      "Do not invent camelCase field names in JQL (for example use \\"RAG Status\\", not ragStatus).",
      "Use initiative filters with project and issue type first, then add custom field predicates.",
      "Always lazy-load: for count questions use countOnly=true and fetch only the number.",
      "For list/detail questions include only required fields, and add customfield IDs from apiFieldIds only when needed."
    ],
    "fieldMap": {
      "ragStatus": "\\"RAG Status\\"",
      "workTypeId": "\\"Work type id\\"",
      "categoryType": "\\"Category Type\\"",
      "quarterYear": "\\"Quarter Year\\""
    },
    "customFieldMap": {
      "cf[11331]": "RAG Status",
      "cf[11353]": "Backlog Health",
      "cf[11354]": "Team RAG",
      "cf[11355]": "Dependencies RAG",
      "cf[11356]": "DPIA/CDIA",
      "cf[11357]": "Budget RAG",
      "cf[11358]": "Report Date",
      "cf[11968]": "Category/Type",
      "cf[13367]": "Business Owner(s)",
      "cf[14106]": "Product Owner(s)",
      "cf[14107]": "Architect(s)",
      "cf[14108]": "Sponsor(s)",
      "cf[14109]": "Head Of Delivery",
      "cf[10095]": "Brand(s)",
      "cf[10117]": "Quarter-Year",
      "cf[10257]": "Status update"
    },
    "apiFieldIds": {
      "RAG Status": "customfield_11331",
      "Backlog Health": "customfield_11353",
      "Team RAG": "customfield_11354",
      "Dependencies RAG": "customfield_11355",
      "DPIA/CDIA": "customfield_11356",
      "Budget RAG": "customfield_11357",
      "Report Date": "customfield_11358",
      "Category/Type": "customfield_11968",
      "Business Owner(s)": "customfield_13367",
      "Product Owner(s)": "customfield_14106",
      "Architect(s)": "customfield_14107",
      "Sponsor(s)": "customfield_14108",
      "Head Of Delivery": "customfield_14109",
      "Brand(s)": "customfield_10095",
      "Quarter-Year": "customfield_10117",
      "Status update": "customfield_10257"
    },
    "examples": [
      "project = PM AND issuetype = Initiative AND \\"RAG Status\\" = GREEN",
      "project = PM AND issuetype = Initiative AND \\"Work type id\\" = 10114",
      "project = PM AND issuetype = Initiative AND \\"RAG Status\\" = GREEN AND \\"Work type id\\" = 10114",
      "fields=summary,status,priority,updated,customfield_11331,customfield_11353,customfield_11354"
    ]
  },
  "properties": {
    "key": {
      "type": "string",
      "description": "Jira issue key",
      "example": "PM-837"
    },
    "id": {
      "type": "string",
      "description": "Jira issue ID",
      "example": "372936"
    },
    "project": {
      "type": "string",
      "description": "Project key",
      "example": "PM"
    },
    "projectName": {
      "type": "string",
      "description": "Project name",
      "example": "Portfolio Management"
    },
    "issueType": {
      "type": "string",
      "description": "Issue type",
      "enum": ["Initiative"],
      "example": "Initiative"
    },
    "summary": {
      "type": "string",
      "description": "Short title of the initiative",
      "example": "Daybreak - One Platform"
    },
    "description": {
      "type": "string",
      "description": "Markdown-style long description",
      "example": "## Description\\n## Idea\\n**Artefact** | **Link** | **Owner** | ..."
    },
    "status": {
      "type": "string",
      "description": "Workflow status",
      "example": "Delivery"
    },
    "priority": {
      "type": "string",
      "description": "Priority of the initiative",
      "example": "High"
    },
    "assignee": {
      "type": ["string", "null"],
      "description": "Display name of assigned user or empty string if unassigned",
      "example": ""
    },
    "reporter": {
      "type": "string",
      "description": "Display name and profile link of the reporter in markdown-like format",
      "example": "[Alex Carter](/people/user-001)"
    },
    "created": {
      "type": "string",
      "format": "date-time",
      "description": "Creation timestamp in ISO 8601",
      "example": "2025-10-29T08:43:00.774Z"
    },
    "updated": {
      "type": "string",
      "format": "date-time",
      "description": "Last updated timestamp in ISO 8601",
      "example": "2026-01-30T15:22:53.888Z"
    },
    "startDate": {
      "type": ["string", "null"],
      "format": "date",
      "description": "Planned start date (yyyy-mm-dd)",
      "example": "2025-10-24"
    },
    "dueDate": {
      "type": ["string", "null"],
      "format": "date",
      "description": "Planned completion date (yyyy-mm-dd)",
      "example": "2026-06-30"
    },
    "resolution": {
      "type": "string",
      "description": "Resolution value if resolved, else empty string",
      "example": ""
    },
    "resolved": {
      "type": "string",
      "description": "Resolved timestamp if resolved, else empty string",
      "example": ""
    },
    "labels": {
      "type": "string",
      "description": "Comma- or space-separated Jira labels as a single string",
      "example": "2026_Planning"
    },
    "components": {
      "type": "string",
      "description": "Comma-separated components as a single string",
      "example": ""
    },
    "fixVersions": {
      "type": "string",
      "description": "Comma-separated fix versions as a single string",
      "example": ""
    },
    "parent": {
      "type": "string",
      "description": "Parent issue key when applicable, otherwise empty string",
      "example": ""
    },
    "epicLink": {
      "type": "string",
      "description": "Epic link for hierarchy, otherwise empty string",
      "example": ""
    },
    "storyPoints": {
      "type": "string",
      "description": "Story points as a string, often empty for Initiatives",
      "example": ""
    },
    "originalEstimate": {
      "type": "string",
      "description": "Original time estimate, or empty string",
      "example": ""
    },
    "timeTracking": {
      "type": "string",
      "description": "Raw time tracking field",
      "example": "null null null"
    },
    "votes": {
      "type": "string",
      "description": "Number of votes as string",
      "example": "0"
    },
    "watchers": {
      "type": "string",
      "description": "Number of watchers as string",
      "example": "1"
    },
    "categoryType": {
      "type": "string",
      "description": "Category/Type of initiative",
      "example": "AI & Data Led"
    },
    "brand": {
      "type": "string",
      "description": "Brand(s) this initiative relates to",
      "example": ""
    },
    "quarterYear": {
      "type": "string",
      "description": "Planning quarter and year (e.g. 'Q1 2026')",
      "example": ""
    },
    "ragStatus": {
      "type": "string",
      "description": "Overall RAG status",
      "example": "GREEN"
    },
    "backlogHealth": {
      "type": "string",
      "description": "Backlog health RAG or text",
      "example": ""
    },
    "teamRag": {
      "type": "string",
      "description": "Team RAG status",
      "example": ""
    },
    "dependenciesRag": {
      "type": "string",
      "description": "Dependencies RAG status",
      "example": ""
    },
    "budgetRag": {
      "type": "string",
      "description": "Budget RAG status",
      "example": ""
    },
    "dpiaCdia": {
      "type": "string",
      "description": "DPIA/CDIA status",
      "example": ""
    },
    "statusUpdate": {
      "type": "string",
      "description": "Latest written status update",
      "example": ""
    },
    "reportDate": {
      "type": "string",
      "description": "Date status was reported",
      "example": ""
    },
    "businessOwners": {
      "type": "string",
      "description": "Business Owner(s) in markdown-like '[Name](/people/ID)' format",
      "example": "[Jordan Blake](/people/user-101)"
    },
    "productOwners": {
      "type": "string",
      "description": "Product Owner(s) in same format",
      "example": ""
    },
    "architects": {
      "type": "string",
      "description": "Architect(s) in same format",
      "example": "[Riley Morgan](/people/user-201)"
    },
    "sponsors": {
      "type": "string",
      "description": "Sponsor(s) in same format",
      "example": "[Jordan Blake](/people/user-101)"
    },
    "headOfDelivery": {
      "type": "string",
      "description": "Head Of Delivery in same format",
      "example": "[Taylor Quinn](/people/user-301)"
    },
    "workTypeId": {
      "type": "string",
      "description": "Internal work type identifier",
      "example": "10114"
    },
    "servicedeskApprovals": {
      "type": "string",
      "description": "Service desk approvals field; usually empty for Initiatives",
      "example": ""
    }
  },
  "required": ["key", "project", "issueType", "summary", "status", "created", "updated"]
}`;
