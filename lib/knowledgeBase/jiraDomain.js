export const JIRA_DOMAIN =`
Use this KB as the Jira overview and query playbook for AIME.

## Preconditions
- User must sign in to Jira from [Jira](/jira) before querying.
- Jira reads are external (not mainTree data).

## How to get Jira context
- If Jira tool schema is missing, call \`req_more_info\` with:
  - \`tools.ids=["emit_jira_query_actions"]\`
- If Jira guidance is missing, request:
  - \`domainKnowledge.ids=["jira-domain"]\`
- If user asks about initiative-specific fields, also request:
  - \`domainKnowledge.ids=["jira-initiative-domain"]\`

## Domain-specific KBs
- \`jira-initiative-domain\`: Initiative field definition (including custom/business fields).
- Load only the minimal Jira domain KB needed for the user request.

## Query rules
- Endpoint: \`GET /api/jira/query\`
- Always send \`toolMode=true\`.
- For "how many" questions, use \`countOnly=true\`.
- For summary count questions, fetch only the number first (no list/details in that call).
- For Jira custom fields in JQL, use the exact quoted field display name (example: \`"RAG Status" = GREEN\`).
- For list/detail questions, use minimal fields first:
  - \`fields=summary,status,project,updated,issuetype,priority\`
- For unique lists, use \`distinct\`:
  - \`project\` | \`issuetype\` | \`status\`
- Keep \`maxResults\` small by default (e.g., 20) unless user asks for more.
- Never load more data than needed; progressively fetch only when user asks follow-up detail.

## Issue-type mapping hints
- initiatives -> \`issuetype = Initiative\`
- epics -> \`issuetype = Epic\`
- stories -> \`issuetype = Story\`
- tasks -> \`issuetype = Task\`
- bugs -> \`issuetype = Bug\`

## Auth error handling (hard stop)
- If Jira tool results indicate 401/403/auth-required:
  - Respond with Jira login instructions only.
  - Do not emit Jira tool actions again in that turn.

## Response behavior
- Reuse existing Jira tool results already in context when possible.
- Do not repeat identical Jira queries in the same turn.
- If user only asked for a count, return only the count and ask whether to fetch details.
- When showing issue keys, use clickable links. Prefer returned \`browseUrl\` when present.
`;
