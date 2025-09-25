// Test the clock calculation manually
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0-indexed

console.log('Current date:', now.toDateString());
console.log('Current month (0-indexed):', currentMonth);

// Determine current quarter start
let quarterStart;
if (currentMonth >= 0 && currentMonth < 3) {
  quarterStart = new Date(currentYear, 0, 1); // Q1: January 1st
} else if (currentMonth >= 3 && currentMonth < 6) {
  quarterStart = new Date(currentYear, 3, 1); // Q2: April 1st
} else if (currentMonth >= 6 && currentMonth < 9) {
  quarterStart = new Date(currentYear, 6, 1); // Q3: July 1st
} else {
  quarterStart = new Date(currentYear, 9, 1); // Q4: October 1st
}

console.log('Quarter start:', quarterStart.toDateString());

// Calculate day index
const diffTime = now - quarterStart;
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

console.log('Days difference:', diffDays);
console.log('Day index (0-based):', diffDays);
console.log('Day number (1-based):', diffDays + 1);

// Test specific dates for verification
const testDates = [
  { name: 'July 1, 2025', date: new Date('2025-07-01') },
  { name: 'July 2, 2025', date: new Date('2025-07-02') },
  { name: 'Sept 23, 2025', date: new Date('2025-09-23') },
  { name: 'Sept 25, 2025', date: new Date('2025-09-25') },
];

console.log('\nTest dates from July 1:');
const july1 = new Date('2025-07-01');
testDates.forEach(test => {
  const diff = Math.floor((test.date - july1) / (1000 * 60 * 60 * 24));
  console.log(`${test.name}: ${diff} days = Day ${diff + 1}`);
});

// Clock hand position calculation (for 84-day cycle)
const handAngle = (diffDays / 84) * 360;
console.log('\nClock hand:');
console.log('Hand angle:', handAngle.toFixed(1), 'degrees');
console.log('Hand position: pointing to', (handAngle / 30).toFixed(1), "o'clock position");