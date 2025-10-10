// Test for potential timezone/boundary issues in TodayClock
const testDateBoundaryIssues = () => {
  console.log('Testing date boundary issues...\n');
  
  // Test different times around potential problem areas
  const testTimes = [
    '2025-10-10T05:28:00+05:30',  // 10:58 AM IST - near 11 AM
    '2025-10-10T05:29:30+05:30',  // 10:59:30 AM IST
    '2025-10-10T05:30:00+05:30',  // 11:00 AM IST - exact task time
    '2025-10-10T05:30:30+05:30',  // 11:00:30 AM IST
    '2025-10-10T05:31:00+05:30',  // 11:01 AM IST
    '2025-10-10T05:32:00+05:30',  // 11:02 AM IST
  ];
  
  const task11am = {
    isScheduled: true,
    scheduledDateTime: '2025-10-10T05:30:00.000Z', // 11:00 AM IST
    description: '11:00 AM IST task'
  };
  
  testTimes.forEach(timeStr => {
    const currentTime = new Date(timeStr);
    const currentTimeIST = currentTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'});
    
    console.log(`\n=== Testing at ${currentTimeIST} ===`);
    
    // Simulate the todayTasks calculation
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`Today boundary: ${today.toISOString()}`);
    console.log(`Tomorrow boundary: ${tomorrow.toISOString()}`);
    
    const taskDate = new Date(task11am.scheduledDateTime);
    const inDateRange = taskDate >= today && taskDate < tomorrow;
    
    console.log(`Task date: ${taskDate.toISOString()}`);
    console.log(`In date range: ${inDateRange}`);
    console.log(`Task >= today: ${taskDate >= today}`);
    console.log(`Task < tomorrow: ${taskDate < tomorrow}`);
    
    // Check current period
    const currentHour = currentTime.getHours();
    let period = 2; // Should be period 2 for all these times
    if (currentHour >= 12) period = 3;
    
    console.log(`Current hour: ${currentHour}, Period: ${period}`);
    
    // Hour filter
    const taskHour = taskDate.getHours();
    let passesHourFilter = false;
    if (period === 2) {
      passesHourFilter = taskHour >= 6 && taskHour < 18;
    } else if (period === 3) {
      passesHourFilter = taskHour >= 12 && taskHour < 24;
    }
    
    console.log(`Task hour: ${taskHour}, Passes hour filter: ${passesHourFilter}`);
    
    const finalVisible = inDateRange && passesHourFilter;
    console.log(`FINAL RESULT: ${finalVisible ? 'VISIBLE' : 'HIDDEN'}`);
  });
  
  // Test potential millisecond precision issues
  console.log('\n=== Testing millisecond precision ===');
  const exactTaskTime = new Date('2025-10-10T05:30:00.000Z');
  const currentTimeAtTask = new Date('2025-10-10T05:30:00.001Z'); // 1ms later
  
  console.log(`Task time: ${exactTaskTime.toISOString()}`);
  console.log(`Current time: ${currentTimeAtTask.toISOString()}`);
  console.log(`Are they on same day (toDateString): ${exactTaskTime.toDateString() === currentTimeAtTask.toDateString()}`);
  
  const today = new Date(currentTimeAtTask);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  console.log(`Task >= today: ${exactTaskTime >= today}`);
  console.log(`Task < tomorrow: ${exactTaskTime < tomorrow}`);
};

testDateBoundaryIssues();