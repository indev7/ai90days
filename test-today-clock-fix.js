// Test script to verify TodayClock period filtering fix
const testTaskTimeFiltering = () => {
  console.log('Testing TodayClock time period filtering...\n');
  
  // Simulate current time in different periods
  const testTimes = [
    { time: '2025-10-10T02:00:00+05:30', period: 1, desc: 'Period 1: 2:00 AM IST' },
    { time: '2025-10-10T08:00:00+05:30', period: 2, desc: 'Period 2: 8:00 AM IST' },
    { time: '2025-10-10T14:00:00+05:30', period: 3, desc: 'Period 3: 2:00 PM IST' },
    { time: '2025-10-10T20:00:00+05:30', period: 4, desc: 'Period 4: 8:00 PM IST' }
  ];
  
  // Sample tasks with UTC times (as stored in database)
  const sampleTasks = [
    { id: 1, scheduledDateTime: '2025-10-10T05:30:00.000Z', description: '11:00 AM IST task' },
    { id: 2, scheduledDateTime: '2025-10-10T12:30:00.000Z', description: '6:00 PM IST task' },
    { id: 3, scheduledDateTime: '2025-10-10T17:30:00.000Z', description: '11:00 PM IST task' },
    { id: 4, scheduledDateTime: '2025-10-10T23:30:00.000Z', description: '5:00 AM next day IST task (should be in period 4)' }
  ];
  
  sampleTasks.forEach(task => {
    const localTime = new Date(task.scheduledDateTime);
    console.log(`${task.description}: ${task.scheduledDateTime} -> ${localTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);
  });
  
  console.log('\n=== Testing Period Filtering ===\n');
  
  testTimes.forEach(({ time, period, desc }) => {
    console.log(`\n${desc} (Period ${period}):`);
    const currentTime = new Date(time);
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    // Apply the filtering logic
    console.log(`  Date boundaries: Today=${today.toISOString()}, Tomorrow=${tomorrow.toISOString()}, DayAfter=${dayAfterTomorrow.toISOString()}`);
    
    const filteredTasks = sampleTasks.filter(task => {
      const taskDate = new Date(task.scheduledDateTime);
      
      // Date range filter (updated logic)
      let inDateRange = false;
      if (period === 4) {
        inDateRange = taskDate >= today && taskDate < dayAfterTomorrow;
        console.log(`    Task ${task.id}: ${task.scheduledDateTime} -> ${taskDate.toISOString()} - inDateRange: ${inDateRange}`);
      } else {
        inDateRange = taskDate >= today && taskDate < tomorrow;
      }
      
      if (!inDateRange) return false;
      
      // Hour range filter
      const taskHour = taskDate.getHours();
      let passesHourFilter = false;
      
      if (period === 1) {
        passesHourFilter = taskHour >= 0 && taskHour < 12;
      } else if (period === 2) {
        passesHourFilter = taskHour >= 6 && taskHour < 18;
      } else if (period === 3) {
        passesHourFilter = taskHour >= 12 && taskHour < 24;
      } else {
        passesHourFilter = taskHour >= 18 || taskHour < 6;
      }
      
      if (period === 4) {
        console.log(`    Task ${task.id} hour check: hour=${taskHour}, passes=(${taskHour} >= 18 || ${taskHour} < 6) = ${passesHourFilter}`);
      }
      
      return passesHourFilter;
    });
    
    console.log('  Visible tasks:');
    if (filteredTasks.length === 0) {
      console.log('    (none)');
    } else {
      filteredTasks.forEach(task => {
        const taskTime = new Date(task.scheduledDateTime);
        console.log(`    - ${task.description} at ${taskTime.toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata'})}`);
      });
    }
  });
};

testTaskTimeFiltering();