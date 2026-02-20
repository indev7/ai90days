export const SNOWFLAKE_DOMAIN = `{
  "dataWarehouse": "Snowflake",
  "description": "Snowflake data warehouse containing business analytics data across multiple domains.",
  "views": {
    "RP_TRP_REVIEWS_TEST": {
      "name": "RP_TRP_REVIEWS_TEST",
      "description": "Trustpilot reviews data for reputation management and customer feedback analysis.",
      "columns": {
        "REVIEWID": {
          "name": "REVIEWID",
          "type": "string",
          "description": "Unique identifier for each review"
        },
        "NUMBEROFREVIEWS": {
          "name": "NUMBEROFREVIEWS",
          "type": "number",
          "description": "Total number of reviews by the reviewer"
        },
        "STARS": {
          "name": "STARS",
          "type": "number",
          "description": "Star rating given (typically 1-5)"
        },
        "LOCATION": {
          "name": "LOCATION",
          "type": "string",
          "description": "Geographic location of the reviewer"
        },
        "CREATEDDATETIME": {
          "name": "CREATEDDATETIME",
          "type": "timestamp",
          "description": "Timestamp when the review was created in the system"
        },
        "SOURCE": {
          "name": "SOURCE",
          "type": "string",
          "description": "Source platform of the review (e.g., Trustpilot)"
        },
        "COMPANYREPLYCREATEDATETIME": {
          "name": "COMPANYREPLYCREATEDATETIME",
          "type": "timestamp",
          "description": "Timestamp when company replied to the review (null if no reply)"
        },
        "STATUS": {
          "name": "STATUS",
          "type": "string",
          "description": "Current status of the review"
        },
        "DOMAIN": {
          "name": "DOMAIN",
          "type": "string",
          "description": "Domain or business unit associated with the review"
        },
        "REVIEWDATE": {
          "name": "REVIEWDATE",
          "type": "date",
          "description": "Date when the review was posted by the customer"
        }
      }
    }
  },
  "sqlGuidance": {
    "rules": [
      "Always use SELECT statements only. No INSERT, UPDATE, DELETE, or DDL operations allowed.",
      "Use fully qualified view names (e.g., RP_TRP_REVIEWS_TEST) when provided.",
      "Column names are case-sensitive and should be in UPPERCASE.",
      "Always include appropriate WHERE clauses to limit data scanned.",
      "Always include a date range filter in every query using the most relevant date/timestamp column for the table.",
      "If the correct date column is unclear, ask a follow-up question before querying.",
      "Use DATE_TRUNC() for grouping by time periods (week, month, year).",
      "Use WEEK() or WEEKOFYEAR() functions for weekly aggregations.",
      "Default to aggregated/summarized queries; avoid returning raw rows unless explicitly requested.",
      "Use COUNT(*) for counting records, AVG(STARS) for average ratings.",
      "Group by DATE_TRUNC('week', REVIEWDATE) for weekly summaries.",
      "If the user explicitly asks for raw samples, you must include a LIMIT and keep it small (max 200).",
      "Never use SELECT *; always select only the needed columns."
    ],
    "examples": [
      {
        "description": "Count reviews by week in January 2026",
        "sql": "SELECT DATE_TRUNC('week', REVIEWDATE) AS week_start, COUNT(*) AS review_count, AVG(STARS) AS avg_rating FROM RP_TRP_REVIEWS_TEST WHERE REVIEWDATE >= '2026-01-01' AND REVIEWDATE < '2026-02-01' GROUP BY DATE_TRUNC('week', REVIEWDATE) ORDER BY week_start"
      },
      {
        "description": "Get a small sample of recent reviews with company replies (explicit sample request)",
        "sql": "SELECT REVIEWID, STARS, REVIEWDATE, COMPANYREPLYCREATEDATETIME FROM RP_TRP_REVIEWS_TEST WHERE COMPANYREPLYCREATEDATETIME IS NOT NULL AND REVIEWDATE >= '2026-01-01' AND REVIEWDATE < '2026-02-01' ORDER BY REVIEWDATE DESC LIMIT 100"
      },
      {
        "description": "Average rating by location",
        "sql": "SELECT LOCATION, COUNT(*) AS review_count, AVG(STARS) AS avg_rating FROM RP_TRP_REVIEWS_TEST WHERE REVIEWDATE >= '2026-01-01' GROUP BY LOCATION ORDER BY review_count DESC LIMIT 20"
      },
      {
        "description": "Monthly review trends",
        "sql": "SELECT DATE_TRUNC('month', REVIEWDATE) AS month, COUNT(*) AS review_count, AVG(STARS) AS avg_rating, COUNT(CASE WHEN COMPANYREPLYCREATEDATETIME IS NOT NULL THEN 1 END) AS replied_count FROM RP_TRP_REVIEWS_TEST WHERE REVIEWDATE >= '2025-01-01' GROUP BY DATE_TRUNC('month', REVIEWDATE) ORDER BY month"
      }
    ]
  },
  "bestPractices": [
    "Always specify date ranges to optimize query performance",
    "Use aggregations (COUNT, AVG, SUM) for summary statistics",
    "Limit result sets with LIMIT clause when appropriate",
    "Use ORDER BY to sort results meaningfully",
    "Consider using CASE statements for conditional aggregations",
    "Format dates consistently using DATE_TRUNC or TO_CHAR functions"
  ]
}`;
