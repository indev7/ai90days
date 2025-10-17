// Debug script to check time blocks for user 4
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'Phase1', 'DB', 'ampcode.db');
const db = new Database(dbPath);

console.log('=== Checking Time Blocks for User 4 ===\n');

// Get all time blocks for user 4
const timeBlocks = db.prepare(`
  SELECT * FROM time_blocks 
  WHERE user_id = 4
  ORDER BY start_time
`).all();

console.log(`Found ${timeBlocks.length} time blocks for user 4:\n`);

timeBlocks.forEach((tb, index) => {
  const startTime = new Date(tb.start_time);
  console.log(`${index + 1}. Time Block ID: ${tb.id}`);
  console.log(`   Task ID: ${tb.task_id}`);
  console.log(`   Start Time: ${tb.start_time}`);
  console.log(`   Start Time (parsed): ${startTime.toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`);
  console.log(`   Hour: ${startTime.getHours()}`);
  console.log(`   Duration: ${tb.duration} minutes`);
  console.log(`   Objective ID: ${tb.objective_id || 'N/A'}`);
  console.log('');
});

// Check what today is
const now = new Date();
console.log(`\n=== Current Time Info ===`);
console.log(`Current time (UTC): ${now.toISOString()}`);
console.log(`Current time (Asia/Colombo): ${now.toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`);
console.log(`Current hour: ${now.getHours()}`);

// Check which period we're in
const currentHour = now.getHours();
let period, taskRangeStart, taskRangeEnd;

if (currentHour >= 0 && currentHour < 6) {
  period = 1;
  taskRangeStart = 0;
  taskRangeEnd = 12;
} else if (currentHour >= 6 && currentHour < 12) {
  period = 2;
  taskRangeStart = 6;
  taskRangeEnd = 18;
} else if (currentHour >= 12 && currentHour < 18) {
  period = 3;
  taskRangeStart = 12;
  taskRangeEnd = 24;
} else {
  period = 4;
  taskRangeStart = 18;
  taskRangeEnd = 30;
}

console.log(`\nCurrent Period: ${period}`);
console.log(`Task Range: ${taskRangeStart}:00 - ${taskRangeEnd}:00`);

// Filter time blocks for today
const today = new Date(now);
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

console.log(`\n=== Today's Time Blocks ===`);
console.log(`Today start: ${today.toISOString()}`);
console.log(`Tomorrow start: ${tomorrow.toISOString()}`);

const todayBlocks = timeBlocks.filter(tb => {
  const tbDate = new Date(tb.start_time);
  return tbDate >= today && tbDate < tomorrow;
});

console.log(`\nFound ${todayBlocks.length} time blocks for today:\n`);

todayBlocks.forEach((tb, index) => {
  const startTime = new Date(tb.start_time);
  const taskHour = startTime.getHours();
  const inRange = (period === 2) ? (taskHour >= 6 && taskHour < 18) : false;
  
  console.log(`${index + 1}. Time Block ID: ${tb.id}`);
  console.log(`   Task ID: ${tb.task_id}`);
  console.log(`   Start Time: ${startTime.toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`);
  console.log(`   Hour: ${taskHour}`);
  console.log(`   In current period range (${taskRangeStart}-${taskRangeEnd}): ${inRange}`);
  console.log('');
});

db.close();