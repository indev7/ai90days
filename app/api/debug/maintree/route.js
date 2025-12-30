import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { all, get } from '@/lib/pgdb';
import { jiraFetchWithRetry, parseJiraIssue } from '@/lib/jiraAuth';

/**
 * GET /api/debug/maintree
 * Diagnostic endpoint to dump complete mainTree structure for debugging
 * Returns full mainTree with all sections including Jira tickets
 */
export async function GET(request) {
  try {
    // Verify authentication
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log(`[Debug MainTree] Fetching for user ${userId}`);

    // Build full mainTree structure
    const mainTree = {
      preferences: null,
      myOKRTs: [],
      sharedOKRTs: [],
      notifications: [],
      timeBlocks: [],
      groups: [],
      jiraTickets: [],
      calendar: { events: [], quarter: null }
    };

    // 1. Preferences
    const preferencesRow = await get(
      `SELECT preferences FROM users WHERE id = ?`,
      [userId]
    );
    
    const defaultPreferences = {
      preferred_voice: 'alloy',
      preferred_home: 'dashboard',
      theme: 'purple'
    };

    if (preferencesRow?.preferences) {
      try {
        const parsed = typeof preferencesRow.preferences === 'string'
          ? JSON.parse(preferencesRow.preferences)
          : preferencesRow.preferences;
        mainTree.preferences = { ...defaultPreferences, ...parsed };
      } catch (e) {
        mainTree.preferences = defaultPreferences;
      }
    } else {
      mainTree.preferences = defaultPreferences;
    }

    // 2. MyOKRTs (simplified - just count)
    const myOKRTs = await all(`
      SELECT id, type, title, description, status, progress
      FROM okrt
      WHERE owner_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);
    mainTree.myOKRTs = myOKRTs;

    // 3. TimeBlocks (count)
    const timeBlocks = await all(`
      SELECT id, task_id, start_time, duration
      FROM time_blocks
      WHERE user_id = ?
      ORDER BY start_time DESC
      LIMIT 10
    `, [userId]);
    mainTree.timeBlocks = timeBlocks;

    // 4. Notifications (count)
    const notifications = await all(`
      SELECT id, type, title, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);
    mainTree.notifications = notifications;

    // 5. Jira Tickets (ALL - this is what we want to verify)
    try {
      console.log('[Debug MainTree] Fetching Jira tickets...');
      const jql = 'assignee = currentUser() ORDER BY updated DESC';
      let allIssues = [];
      let fetchedAll = false;
      let currentStart = 0;
      const batchSize = 100;
      
      while (!fetchedAll && currentStart < 1000) {
        const params = new URLSearchParams({
          jql: jql,
          startAt: currentStart.toString(),
          maxResults: batchSize.toString(),
          fields: 'summary,status,assignee,reporter,priority,issuetype,project,created,updated,labels,description'
        });
        
        const jiraResp = await jiraFetchWithRetry(`/rest/api/3/search/jql?${params}`);
        const jiraJson = await jiraResp.json();
        const batch = jiraJson.issues || jiraJson.values || [];
        
        if (batch.length === 0) {
          fetchedAll = true;
        } else {
          allIssues = allIssues.concat(batch);
          currentStart += batch.length;
          
          if (batch.length < batchSize) {
            fetchedAll = true;
          }
        }
      }
      
      const parsed = allIssues.map(parseJiraIssue).filter(i => i !== null);
      mainTree.jiraTickets = parsed;
      console.log(`[Debug MainTree] Fetched ${parsed.length} Jira tickets`);
    } catch (e) {
      console.warn('[Debug MainTree] Failed to load jiraTickets:', e?.message || e);
      mainTree.jiraTickets = [];
    }

    // Calculate sizes
    const sizes = {
      preferences: JSON.stringify(mainTree.preferences).length,
      myOKRTs: JSON.stringify(mainTree.myOKRTs).length,
      timeBlocks: JSON.stringify(mainTree.timeBlocks).length,
      notifications: JSON.stringify(mainTree.notifications).length,
      jiraTickets: JSON.stringify(mainTree.jiraTickets).length,
      total: JSON.stringify(mainTree).length
    };

    const counts = {
      myOKRTs: mainTree.myOKRTs.length,
      timeBlocks: mainTree.timeBlocks.length,
      notifications: mainTree.notifications.length,
      jiraTickets: mainTree.jiraTickets.length
    };

    console.log('[Debug MainTree] Sizes (bytes):', sizes);
    console.log('[Debug MainTree] Counts:', counts);

    return NextResponse.json({
      mainTree,
      debug: {
        sizes,
        counts,
        totalBytes: sizes.total,
        totalKB: (sizes.total / 1024).toFixed(2),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Debug MainTree] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mainTree', details: error.message },
      { status: 500 }
    );
  }
}
