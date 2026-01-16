// app/api/jira/leave-parents/route.js

import { NextResponse } from 'next/server';
import { jiraFetchWithRetry } from '@/lib/jiraAuth';

/**
 * GET /api/jira/leave-parents
 * Dynamically fetch leave parent issue keys for the current year
 */
export async function GET() {
    try {
        const currentYear = new Date().getFullYear();
        const leaveParents = {};

        // Enhanced search strategies for leave parent issues with dynamic year
        const searchStrategies = [
            {
                type: `Medical Leaves ${currentYear}`,
                queries: [
                    `project = "ILT" AND summary ~ "Medical Leaves ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Medical Leave ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Medical" AND summary ~ "${currentYear}"`,
                    // Fallback to previous year if current year not found
                    `project = "ILT" AND summary ~ "Medical Leaves ${currentYear - 1}"`,
                    `project = "ILT" AND summary ~ "Medical Leave ${currentYear - 1}"`
                ]
            },
            {
                type: `Casual Leaves ${currentYear}`,
                queries: [
                    `project = "ILT" AND summary ~ "Casual Leaves ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Casual Leave ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Casual" AND summary ~ "${currentYear}"`,
                    // Fallback to previous year
                    `project = "ILT" AND summary ~ "Casual Leaves ${currentYear - 1}"`,
                    `project = "ILT" AND summary ~ "Casual Leave ${currentYear - 1}"`
                ]
            },
            {
                type: `Annual Leaves ${currentYear}`,
                queries: [
                    `project = "ILT" AND summary ~ "Annual Leaves ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Annual Leave ${currentYear}"`,
                    `project = "ILT" AND summary ~ "Annual" AND summary ~ "${currentYear}"`,
                    // Fallback to previous year
                    `project = "ILT" AND summary ~ "Annual Leaves ${currentYear - 1}"`,
                    `project = "ILT" AND summary ~ "Annual Leave ${currentYear - 1}"`
                ]
            }
        ];

        console.log(`🔍 Searching for leave parents for year ${currentYear}...`);

        for (const strategy of searchStrategies) {
            let found = false;

            for (const jql of strategy.queries) {
                if (found) break;

                try {
                    const response = await jiraFetchWithRetry(
                        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=key,summary,issuetype,project,created`
                    );
                    const data = await response.json();

                    console.log(`🔍 Leave parent search for "${strategy.type}":`, {
                        jql,
                        foundIssues: data.issues?.length || 0,
                        issues: data.issues?.map(issue => ({
                            key: issue.key,
                            summary: issue.fields?.summary,
                            issueType: issue.fields?.issuetype?.name,
                            created: issue.fields?.created
                        })) || []
                    });

                    if (data.issues && data.issues.length > 0) {
                        // Prefer non-subtask issues as parents, and prioritize by creation date (newest first)
                        const sortedIssues = data.issues
                            .filter(issue =>
                                issue.fields?.issuetype?.name !== 'Leave-Request' &&
                                issue.fields?.issuetype?.subtask !== true
                            )
                            .sort((a, b) => new Date(b.fields?.created) - new Date(a.fields?.created));

                        const parentIssue = sortedIssues[0] || data.issues[0];

                        leaveParents[strategy.type] = parentIssue.key;
                        console.log(`✅ Found parent for ${strategy.type}: ${parentIssue.key} (${parentIssue.fields?.summary})`);
                        found = true;
                    }
                } catch (searchError) {
                    console.warn(`⚠️ Search failed for "${jql}":`, searchError.message);
                }
            }

            if (!found) {
                console.warn(`❌ No parent found for ${strategy.type} after trying all search strategies`);
            }
        }

        // Add fallback keys for safety (these should match your current working keys)
        const fallbackKeys = {
            [`Medical Leaves ${currentYear}`]: leaveParents[`Medical Leaves ${currentYear}`] || 'ILT-11953',
            [`Casual Leaves ${currentYear}`]: leaveParents[`Casual Leaves ${currentYear}`] || 'ILT-11602',
            [`Annual Leaves ${currentYear}`]: leaveParents[`Annual Leaves ${currentYear}`] || 'ILT-12448'
        };

        const finalLeaveParents = { ...fallbackKeys, ...leaveParents };

        console.log('📋 Final leave parents mapping:', {
            currentYear,
            foundDynamically: Object.keys(leaveParents).length,
            withFallbacks: Object.keys(finalLeaveParents).length,
            mapping: finalLeaveParents
        });

        return NextResponse.json({
            success: true,
            currentYear,
            leaveParents: finalLeaveParents,
            dynamicallyFound: Object.keys(leaveParents).length,
            message: `Found ${Object.keys(leaveParents).length} leave parent keys dynamically for year ${currentYear}`
        });

    } catch (error) {
        console.error('❌ Error fetching leave parents:', error);

        // Return safe fallback response
        const currentYear = new Date().getFullYear();
        return NextResponse.json({
            success: false,
            error: error.message,
            currentYear,
            leaveParents: {
                [`Medical Leaves ${currentYear}`]: 'ILT-11953',
                [`Casual Leaves ${currentYear}`]: 'ILT-11602',
                [`Annual Leaves ${currentYear}`]: 'ILT-12448'
            },
            message: 'Using fallback leave parent keys due to fetch error'
        }, { status: 500 });
    }
}