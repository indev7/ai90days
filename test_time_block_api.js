// Test script to verify time block API with objective_id

const testData = {
  task_id: "gen-lv276abs", // Using existing task ID from database
  start_time: "2025-10-04T14:30:00.000Z", // 2:30 PM today
  duration: 60, // 1 hour
  objective_id: "gen-u1xyz490" // Using existing objective ID
};

console.log('Testing time block creation with objective_id...');
console.log('Test data:', JSON.stringify(testData, null, 2));

// This would be called from the browser after authentication
// fetch('/api/time-blocks', {
//   method: 'POST', 
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify(testData)
// })