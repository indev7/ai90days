# JIRA API Error Handling Fix

## Problem
When JIRA API errors occurred, the proxy API would break and the frontend would stop working. Errors were not being gracefully handled and returned to the frontend/LLM in a structured format.

## Root Causes
1. **Unstructured error messages**: In [`lib/jiraAuth.js`](lib/jiraAuth.js:94), JIRA API errors were thrown with the full error text, which could be very long and break the response
2. **Incomplete error handling**: The error handling in [`app/api/jira/query/route.js`](app/api/jira/query/route.js:591) didn't properly handle all JIRA API error cases
3. **No JSON parsing safety**: `response.json()` calls could fail without proper error handling
4. **Missing user-friendly messages**: Errors weren't formatted for LLM consumption

## Changes Made

### 1. Enhanced Error Structure in `lib/jiraAuth.js`
**Location**: Lines 94-120

**Before**:
```javascript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Jira API error:', response.status, response.statusText, errorText);
  throw new Error(`Jira API error: ${response.status} - ${errorText}`);
}
```

**After**:
```javascript
if (!response.ok) {
  let errorText = '';
  let errorData = null;
  
  try {
    errorText = await response.text();
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Not JSON, use text as-is
    }
  } catch (readError) {
    errorText = 'Unable to read error response';
  }

  console.error('Jira API error:', response.status, response.statusText, errorText);
  
  // Create a structured error object
  const errorInfo = {
    status: response.status,
    statusText: response.statusText,
    errorMessages: errorData?.errorMessages || [],
    errors: errorData?.errors || {},
    rawError: errorText.substring(0, 500) // Limit error text length
  };
  
  // Throw with structured error that can be caught and formatted
  const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
  error.jiraError = errorInfo;
  throw error;
}
```

**Benefits**:
- Structured error information attached to the error object
- Error text limited to 500 characters to prevent response overflow
- Safely parses JSON error responses from JIRA
- Preserves both error messages and error details

### 2. Comprehensive Error Handling in `app/api/jira/query/route.js`
**Location**: Lines 591-680

**Added**:
- Structured JIRA API error handling with `error.jiraError` support
- User-friendly messages for LLM consumption
- Specific error codes for different error types
- Action suggestions for each error type
- JQL validation error handling
- Proper HTTP status codes for each error type

**Error Response Format**:
```javascript
{
  error: 'Error type',
  code: 'ERROR_CODE',
  message: 'Technical message',
  userMessage: 'User-friendly message for LLM',
  action: 'Suggested action',
  errorMessages: [], // JIRA error messages (if applicable)
  errors: {},        // JIRA error details (if applicable)
  status: 400        // HTTP status from JIRA (if applicable)
}
```

**Error Types Handled**:
1. **Authentication errors** (401)
   - Code: `JIRA_AUTH_REQUIRED`
   - Action: Login at /jira

2. **Timeout errors** (504)
   - Code: `TIMEOUT`
   - Action: Try simpler query

3. **JIRA API errors** (varies)
   - Code: `JIRA_API_ERROR`
   - Includes structured error messages from JIRA
   - Preserves original status code

4. **JQL validation errors** (400)
   - Code: `INVALID_JQL`
   - Action: Correct JQL syntax

5. **Generic errors** (500)
   - Code: `INTERNAL_ERROR`
   - Includes details in development mode

### 3. Safe JSON Parsing
**Location**: Lines 105-120

**Added helper function**:
```javascript
async function safeJsonParse(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('Empty response from Jira API');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse Jira response:', error.message);
    throw new Error(`Invalid JSON response from Jira: ${error.message}`);
  }
}
```

**Updated all `response.json()` calls** to use `safeJsonParse(response)`:
- Line 111: `fetchApproximateCount`
- Line 392: Main search query
- Line 504: Distinct search query

**Benefits**:
- Catches empty responses
- Provides clear error messages for JSON parsing failures
- Prevents unhandled promise rejections

## Testing Scenarios

### 1. Invalid JQL Query
**Example**: Query with reserved character `@`
```
Error in the JQL Query: The character '@' is a reserved JQL character.
```

**Response**:
```json
{
  "error": "JIRA API error",
  "code": "JIRA_API_ERROR",
  "status": 400,
  "message": "Error in the JQL Query: The character '@' is a reserved JQL character...",
  "errorMessages": ["Error in the JQL Query: The character '@' is a reserved JQL character..."],
  "errors": {},
  "userMessage": "Jira error: Error in the JQL Query...",
  "action": "Please check your query syntax and try again"
}
```

### 2. Authentication Required
**Response**:
```json
{
  "error": "Authentication required",
  "code": "JIRA_AUTH_REQUIRED",
  "message": "You need to authenticate with Jira before making queries.",
  "action": "Please login at /jira",
  "userMessage": "Please authenticate with Jira to continue."
}
```

### 3. Request Timeout
**Response**:
```json
{
  "error": "Request timeout",
  "code": "TIMEOUT",
  "message": "The Jira request took too long to complete.",
  "action": "Please try again with a simpler query",
  "userMessage": "The request timed out. Please try a simpler query or filter."
}
```

## Impact

### Before
- ❌ API errors would crash the proxy
- ❌ Frontend would stop working
- ❌ LLM received no error information
- ❌ Long error messages could break responses
- ❌ No structured error information

### After
- ✅ All errors are caught and handled gracefully
- ✅ Frontend receives structured error responses
- ✅ LLM gets user-friendly error messages with actions
- ✅ Error messages are limited in length
- ✅ Proper HTTP status codes returned
- ✅ Detailed error information preserved for debugging
- ✅ JSON parsing errors are handled safely

## Files Modified
1. [`lib/jiraAuth.js`](lib/jiraAuth.js) - Enhanced error structure
2. [`app/api/jira/query/route.js`](app/api/jira/query/route.js) - Comprehensive error handling

## Backward Compatibility
✅ All changes are backward compatible. The API still returns the same success response format, only error responses are enhanced.

## Next Steps
1. Test with various JIRA error scenarios
2. Monitor error logs for any unhandled cases
3. Consider adding error telemetry/monitoring
4. Update frontend to display user-friendly error messages
