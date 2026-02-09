/**
 * JIRA Pagination Helper
 * Extracted from app/aime/page.js to reduce cyclomatic complexity
 */

import JIRA_CONFIG from '@/lib/jiraConfig';

/**
 * Check if pagination should stop based on various conditions
 * @param {Object} params - Check parameters
 * @returns {Object} { shouldStop, reason, updates }
 */
export function checkPaginationStopConditions(params) {
  const {
    aggregated,
    result,
    pagesFetched,
    seenPageSignatures,
    seenTokens,
    lastFirstKey,
    lastLastKey,
    lastIssueCount,
    startTime,
    maxJiraPages = JIRA_CONFIG.MAX_PAGES_PER_REQUEST,
    maxIssues = JIRA_CONFIG.MAX_ISSUES_PER_REQUEST,
    paginationTimeout = JIRA_CONFIG.PAGINATION_TIMEOUT_MS
  } = params;

  // Check timeout
  if (Date.now() - startTime > paginationTimeout) {
    console.warn('[JIRA] Pagination timeout reached');
    return {
      shouldStop: true,
      reason: 'timeout',
      updates: { partial: true, timeoutReached: true }
    };
  }

  // Check issue count limit
  const aggregatedIssueCount = Array.isArray(aggregated?.issues) 
    ? aggregated.issues.length : 0;
  
  if (aggregatedIssueCount >= maxIssues) {
    console.warn(`[JIRA] Max issues limit reached: ${aggregatedIssueCount}`);
    return {
      shouldStop: true,
      reason: 'max_issues',
      updates: { partial: true, truncated: true }
    };
  }

  // Check page size
  const pageSize = Array.isArray(result?.issues) ? result.issues.length : 0;
  if (pageSize === 0) {
    return {
      shouldStop: true,
      reason: 'empty_page',
      updates: {}
    };
  }

  // Check for duplicate page signature
  const firstKey = result?.issues?.[0]?.key || '';
  const lastKey = result?.issues?.[pageSize - 1]?.key || '';
  const nextPageToken = result?.nextPageToken || null;
  const pageSignature = `${firstKey}|${lastKey}|${pageSize}|${nextPageToken || ''}`;
  
  if (seenPageSignatures.has(pageSignature)) {
    return {
      shouldStop: true,
      reason: 'duplicate_page',
      updates: {}
    };
  }

  // Check for duplicate keys
  if (firstKey && lastKey && firstKey === lastFirstKey && lastKey === lastLastKey) {
    return {
      shouldStop: true,
      reason: 'duplicate_keys',
      updates: {}
    };
  }

  // Check for duplicate token
  if (nextPageToken && seenTokens.has(nextPageToken)) {
    return {
      shouldStop: true,
      reason: 'duplicate_token',
      updates: {}
    };
  }

  // Check if we've reached the total
  const total = Number.isFinite(result?.total) ? result.total : null;
  if (Number.isFinite(total) && aggregated?.issues?.length >= total) {
    return {
      shouldStop: true,
      reason: 'reached_total',
      updates: {}
    };
  }

  // Check if issue count is not increasing
  const currentIssueCount = Array.isArray(aggregated?.issues) 
    ? aggregated.issues.length : 0;
  
  if (currentIssueCount <= lastIssueCount) {
    return {
      shouldStop: true,
      reason: 'stalled',
      updates: {}
    };
  }

  // Check if marked as last page
  const isLast = result?.isLast === true;
  if (isLast || !nextPageToken) {
    return {
      shouldStop: true,
      reason: 'last_page',
      updates: {}
    };
  }

  // Check hasMore flag (only for non-distinct queries)
  // Distinct queries don't have hasMore, they have 'partial' flag
  const isDistinctQuery = result?.statuses || result?.issueTypes || result?.projects;
  
  if (!isDistinctQuery) {
    const startAt = Number.isFinite(result?.startAt)
      ? result.startAt
      : 0;
    
    const hasMore = Boolean(result?.hasMore || nextPageToken) ||
      (Number.isFinite(total) && startAt + pageSize < total);

    if (!hasMore) {
      return {
        shouldStop: true,
        reason: 'no_more',
        updates: {}
      };
    }
  }

  // Continue pagination
  return {
    shouldStop: false,
    reason: null,
    updates: {}
  };
}

/**
 * Merge issues from a page into aggregated results
 * @param {Object} aggregated - Aggregated results so far
 * @param {Object} result - Current page result
 * @param {number} maxIssues - Maximum issues to accumulate
 * @returns {Object} Updated aggregated results
 */
export function mergePageResults(aggregated, result, maxIssues = JIRA_CONFIG.MAX_ISSUES_PER_REQUEST) {
  if (!aggregated) {
    return { ...result };
  }

  if (!Array.isArray(result?.issues)) {
    return aggregated;
  }

  const existingIssues = Array.isArray(aggregated?.issues) ? aggregated.issues : [];
  
  // Limit total issues to prevent memory issues
  const remainingSlots = maxIssues - existingIssues.length;
  const issuesToAdd = result.issues.slice(0, remainingSlots);
  
  const updated = {
    ...aggregated,
    issues: [...existingIssues, ...issuesToAdd],
    pageSize: existingIssues.length + issuesToAdd.length
  };

  if (Number.isFinite(result?.total)) {
    updated.total = result.total;
  }

  // Mark as truncated if we hit the limit
  if (issuesToAdd.length < result.issues.length) {
    updated.truncated = true;
    updated.partial = true;
  }

  return updated;
}

/**
 * Calculate next pagination payload
 * @param {Object} params - Calculation parameters
 * @returns {Object} Next payload for pagination
 */
export function calculateNextPayload(params) {
  const { currentPayload, result } = params;
  
  const nextPageToken = result?.nextPageToken || null;
  const startAt = Number.isFinite(result?.startAt) ? result.startAt : 0;
  const maxResults = Number.isFinite(result?.maxResults) 
    ? result.maxResults 
    : (Number.isFinite(currentPayload?.maxResults) ? currentPayload.maxResults : null);
  const pageSize = Array.isArray(result?.issues) ? result.issues.length : 0;

  let nextPayload = { ...currentPayload };

  if (nextPageToken) {
    nextPayload.nextPageToken = nextPageToken;
    if ('startAt' in nextPayload) {
      delete nextPayload.startAt;
    }
  } else if (Number.isFinite(maxResults)) {
    nextPayload.startAt = startAt + maxResults;
  } else {
    nextPayload.startAt = startAt + pageSize;
  }

  return nextPayload;
}

/**
 * Extract tracking data from result for deduplication
 * @param {Object} result - Page result
 * @returns {Object} Tracking data
 */
export function extractTrackingData(result) {
  const pageSize = Array.isArray(result?.issues) ? result.issues.length : 0;
  const firstKey = result?.issues?.[0]?.key || '';
  const lastKey = result?.issues?.[pageSize - 1]?.key || '';
  const nextPageToken = result?.nextPageToken || null;
  const pageSignature = `${firstKey}|${lastKey}|${pageSize}|${nextPageToken || ''}`;

  return {
    firstKey,
    lastKey,
    nextPageToken,
    pageSignature,
    pageSize
  };
}
