/**
 * Date utility functions for handling UTC timestamps and local time conversion
 */

/**
 * Format a UTC timestamp to local time with relative display
 * @param {string} utcDateString - ISO 8601 UTC timestamp from database (TIMESTAMPTZ)
 * @returns {string} Formatted relative or absolute time in user's local timezone
 */
export function formatNotificationTime(utcDateString) {
  if (!utcDateString) return '';
  
  // Parse as UTC - ensure the timestamp is treated as UTC
  // PostgreSQL TIMESTAMPTZ may return without 'Z' suffix, so we need to append it
  const isoString = utcDateString.includes('Z') || utcDateString.includes('+')
    ? utcDateString
    : utcDateString.replace(' ', 'T') + 'Z';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relative time for recent notifications
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Absolute time for older notifications (in user's local timezone)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a UTC timestamp to full local datetime
 * @param {string} utcDateString - ISO 8601 UTC timestamp from database (TIMESTAMPTZ)
 * @returns {string} Full formatted datetime in user's local timezone
 */
export function formatFullDateTime(utcDateString) {
  if (!utcDateString) return '';
  
  // Parse as UTC - ensure the timestamp is treated as UTC
  const isoString = utcDateString.includes('Z') || utcDateString.includes('+')
    ? utcDateString
    : utcDateString.replace(' ', 'T') + 'Z';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

/**
 * Format a UTC timestamp for display in notification widgets
 * Similar to formatNotificationTime but with more detailed formatting for dashboard
 * @param {string} utcDateString - ISO 8601 UTC timestamp from database (TIMESTAMPTZ)
 * @returns {string} Formatted time string
 */
export function formatDateTime(utcDateString) {
  if (!utcDateString) return '';
  
  // Parse as UTC - ensure the timestamp is treated as UTC
  // PostgreSQL TIMESTAMPTZ may return without 'Z' suffix, so we need to append it
  const isoString = utcDateString.includes('Z') || utcDateString.includes('+')
    ? utcDateString
    : utcDateString.replace(' ', 'T') + 'Z';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relative time for recent items
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Absolute time for older items (in user's local timezone)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${dayNames[date.getDay()]} ${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
}