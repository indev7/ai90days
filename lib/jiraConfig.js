/**
 * JIRA Integration Configuration
 * Centralized configuration for JIRA API integration
 */

export const JIRA_CONFIG = {
  // API Limits
  MAX_RESULTS_MIN: 1,
  MAX_RESULTS_MAX: 5000,
  MAX_DISTINCT_PAGES: 10,
  
  // Pagination
  MAX_PAGES_PER_REQUEST: 10,
  DEFAULT_PAGE_SIZE: 100,
  
  // Response Size Limits
  MAX_ISSUES_PER_REQUEST: 500,
  MAX_PAYLOAD_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  
  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_WINDOW: '1h',
  
  // JQL Validation
  MAX_JQL_AND_OR_CLAUSES: 10,
  MAX_JQL_IN_CLAUSES: 5,
  MAX_JQL_LENGTH: 2000,
  
  // Field Validation
  MAX_FIELDS_COUNT: 20,
  DEFAULT_FIELDS: 'summary,status,project,updated,issuetype,priority',
  ALLOWED_DISTINCT_FIELDS: ['project', 'issuetype', 'status'],
  
  // Timeouts
  PAGINATION_TIMEOUT_MS: 60000, // 60 seconds total for multi-page fetch
  
  // Retry Configuration
  MAX_AUTO_READ_RETRIES: 2,
  MAX_DUPLICATE_AUTO_READ_RETRIES: 1,
  MAX_JIRA_REQUERY_ATTEMPTS: 2, // Allow up to 3 total attempts (0, 1, 2) before blocking
  JIRA_GUARD_RESET_MS: 30000, // Reset guard after 30 seconds
};

export default JIRA_CONFIG;
