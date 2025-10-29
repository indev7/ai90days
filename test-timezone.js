// Test script to debug timezone issue
// Run with: node test-timezone.js

const testTimestamp = '2025-10-29 09:52:36.835729';

console.log('Original timestamp from DB:', testTimestamp);
console.log('');

// Current approach
const isoString = testTimestamp.includes('Z') || testTimestamp.includes('+') 
  ? testTimestamp 
  : testTimestamp.replace(' ', 'T') + 'Z';

console.log('Converted to ISO with Z:', isoString);

const date = new Date(isoString);
console.log('Parsed Date object:', date);
console.log('Date in UTC:', date.toUTCString());
console.log('Date in ISO:', date.toISOString());
console.log('Date in local (Colombo):', date.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
console.log('');

// Calculate time difference
const now = new Date();
console.log('Current time:', now);
console.log('Current time in UTC:', now.toUTCString());
console.log('Current time in Colombo:', now.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
console.log('');

const diffMs = now - date;
const diffMins = Math.floor(diffMs / 60000);
const diffHours = Math.floor(diffMs / 3600000);

console.log('Time difference:');
console.log('  Milliseconds:', diffMs);
console.log('  Minutes:', diffMins);
console.log('  Hours:', diffHours);
console.log('');

// What it should show
if (diffMins < 1) console.log('Display: Just now');
else if (diffMins < 60) console.log(`Display: ${diffMins}m ago`);
else if (diffHours < 24) console.log(`Display: ${diffHours}h ago`);