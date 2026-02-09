export const JIRA_LEAVE_DOMAIN = `{
  "issueType": "Leave-Request",
  "projectKey": "ILT",
  "projectName": "Intervest Leave Tracker",
  "xJqlGuidance": {
    "rules": [
      "Always lazy-load. For summary count questions, use countOnly=true and fetch only the number.",
      "Use project + issue type filters first: project = ILT AND issuetype = \\"Leave-Request\\".",
      "For custom Jira fields in JQL, use exact quoted display names (example: \\"Leave Type\\", \\"Line Manager\\").",
      "For list/detail questions, request only required fields in fields=... and include customfield IDs only when needed."
    ],
    "apiFieldIds": {
      "Designation": "customfield_10152",
      "Chapter": "customfield_10153",
      "Resource Id": "customfield_10159",
      "Technology Type": "customfield_10288",
      "Line Manager": "customfield_11328",
      "Leave Type": "customfield_11602",
      "Days": "customfield_11603",
      "Project Manager": "customfield_11637",
      "Functional Area": "customfield_12133",
      "Career Level": "customfield_12929",
      "Company": "customfield_13433"
    },
    "customFieldMap": {
      "cf[10152]": "Designation",
      "cf[10153]": "Chapter",
      "cf[10159]": "Resource Id",
      "cf[10288]": "Technology Type",
      "cf[11328]": "Line Manager",
      "cf[11602]": "Leave Type",
      "cf[11603]": "Days",
      "cf[11637]": "Project Manager",
      "cf[12133]": "Functional Area",
      "cf[12929]": "Career Level",
      "cf[13433]": "Company"
    },
    "examples": [
      "project = ILT AND issuetype = \\"Leave-Request\\" AND \\"Leave Type\\" = Annual",
      "project = ILT AND issuetype = \\"Leave-Request\\" AND \\"Line Manager\\" = currentUser()",
      "fields=summary,status,assignee,reporter,created,updated,startDate,dueDate,customfield_11602,customfield_11603"
    ]
  },
  "standardFields": {
    "summary": {
      "name": "Summary",
      "type": "string",
      "description": "Details of the leave. Recommended format: <Leave Type> - <Period> - <Date or Date Range>."
    },
    "description": {
      "name": "Description",
      "type": "string",
      "description": "Details of the leave and cover person. Automation reminds users if cover is missing."
    },
    "status": {
      "name": "Status",
      "type": "status",
      "values": [
        "OPEN",
        "HR REVIEW",
        "MANAGER REVIEW",
        "APPROVED",
        "REJECTED",
        "DONE",
        "CANCELLED"
      ]
    },
    "parent": {
      "name": "Parent",
      "type": "issue",
      "description": "Entitlement record under which this Leave-Request is created."
    },
    "assignee": { "name": "Assignee", "type": "user" },
    "reporter": { "name": "Reporter", "type": "user" },
    "created": { "name": "Created", "type": "datetime" },
    "updated": { "name": "Updated", "type": "datetime" },
    "startDate": { "name": "Start date", "type": "date" },
    "dueDate": {
      "name": "Due date",
      "type": "date",
      "description": "Auto-calculated as Start date + Days."
    },
    "labels": { "name": "Labels", "type": "labels" },
    "securityLevel": { "name": "Security Level", "type": "security" }
  },
  "customFieldsByName": {
    "Designation": {
      "name": "Designation",
      "type": "string",
      "description": "Employee role/title (e.g. Head of UI-UI Architect)."
    },
    "Chapter": {
      "name": "Chapter",
      "type": "string",
      "description": "Organisational chapter, also used in ILT calendars."
    },
    "Resource Id": {
      "name": "Resource Id",
      "type": "string",
      "description": "Employee resource identifier from Entitlement record."
    },
    "Technology Type": {
      "name": "Technology Type",
      "type": "string",
      "description": "Tech type for the employee (e.g. Management, Engineering)."
    },
    "Line Manager": {
      "name": "Line Manager",
      "type": "user",
      "description": "Line manager of the requester, copied from Entitlement."
    },
    "Authorised Users": {
      "name": "Authorised Users",
      "type": "string"
    },
    "Leave Type": {
      "name": "Leave Type",
      "type": "select",
      "values": ["Casual", "Medical", "Annual"],
      "description": "Leave category copied from Entitlement (Casual / Medical / Annual)."
    },
    "Days": {
      "name": "Days",
      "type": "number",
      "description": "Number of working days requested (excl. Sat-Sun)."
    },
    "Project Manager": {
      "name": "Project Manager",
      "type": "user"
    },
    "Functional Area": {
      "name": "Functional Area",
      "type": "string",
      "description": "E.g. Technology, Operations, etc."
    },
    "Career Level": {
      "name": "Career Level",
      "type": "string",
      "description": "Seniority band (e.g. Head, Lead, etc.)."
    },
    "Company": {
      "name": "Company",
      "type": "string",
      "description": "Legal entity / employing company, when applicable."
    },
    "Work type id": {
      "name": "Work type id",
      "type": "number",
      "description": "Internal ID for work-type mapping (e.g. 11199)."
    }
  }
}`;
