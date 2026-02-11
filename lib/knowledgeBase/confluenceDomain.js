export const CONFLUENCE_DOMAIN = `
Use this KB as the Confluence overview and query playbook for AIME.

## Preconditions
- User must sign in to Confluence from [Confluence](/confluence) before querying.
- Confluence reads are external (not mainTree data).

## How to get Confluence context
- If Confluence tool schema is missing, call \`req_more_info\` with:
  - \`tools.ids=["emit_confluence_query_actions"]\`
- If Confluence guidance is missing, request:
  - \`domainKnowledge.ids=["confluence-domain"]\`

## Query rules
- Endpoint: \`GET /api/confluence/search\`
- Always send \`toolMode=true\`.
- Use CQL for search (Confluence Query Language).
- Keep \`limit\` small by default (10-20) unless user asks for more.
- Use \`cursor\` only when continuing pagination from a previous result.

### Common CQL patterns
- Pages by keyword: \`type=page AND text ~ "onboarding"\`
- Pages in a space: \`space = "ENG" AND type=page\`
- Recent updates: \`type=page AND lastmodified > now("-30d")\`
- Title matches: \`type=page AND title ~ "roadmap"\`

## Response behavior
- Prefer compact result summaries (title, space, last updated, link).
- If the user asks to open or read a page, provide the link and ask if they want a deeper fetch.
- Never invent Confluence content; only use tool results.

## Auth error handling (hard stop)
- If Confluence tool results indicate 401/403/auth-required:
  - Respond with Confluence login instructions only.
  - Do not emit Confluence tool actions again in that turn.
`;
