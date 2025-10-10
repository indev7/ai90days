// Test to reproduce the 11 AM task disappearing bug
const testTaskDisappearance = () => {
  console.log('Testing 11 AM task disappearance bug...\n');
  
  // Simulate task scheduled for 11:00 AM IST today (stored as UTC)
  const task11am = {
    id: 1,
    isScheduled: true,
    scheduledDateTime: '2025-10-10T05:30:00.000Z', // 11:00 AM IST
    description: '11:00 AM IST task',
    duration: 30
  };
  
  const todoTasks = [task11am];
  
  // Test different current times throughout the day
  const testTimes = [
    '2025-10-10T04:30:00.000Z', // 10:00 AM IST - when task was created
    '2025-10-10T05:00:00.000Z', // 10:30 AM IST
    '2025-10-10T05:30:00.000Z', // 11:00 AM IST - exact task time
    '2025-10-10T06:00:00.000Z', // 11:30 AM IST - when it disappeared
    '2025-10-10T06:30:00.000Z', // 12:00 PM IST - period transition
    '2025-10-10T07:00:00.000Z'  // 12:30 PM IST - after transition
  ];
  
  testTimes.forEach(currentTimeUTC => {
    const currentTime = new Date(currentTimeUTC);
    const currentTimeIST = currentTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'});
    const currentHour = currentTime.getHours();
    
    console.log(`\n=== Testing at ${currentTimeIST} (${currentTimeUTC}) ===`);
    console.log(`Current hour in local time: ${currentHour}`);
    
    // Determine period
    let period;
    if (currentHour >= 0 && currentHour < 6) {
      period = 1;
    } else if (currentHour >= 6 && currentHour < 12) {
      period = 2;
    } else if (currentHour >= 12 && currentHour < 18) {
      period = 3;
    } else {
      period = 4;
    }
    
    console.log(`Period: ${period}`);
    
    // Simulate todayTasks filtering
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`Today boundary: ${today.toISOString()}`);
    console.log(`Tomorrow boundary: ${tomorrow.toISOString()}`);
    
    const todayTasksFiltered = todoTasks.filter(task => {
      if (!task.isScheduled) return false;
      const taskDate = new Date(task.scheduledDateTime);
      const inRange = taskDate >= today && taskDate < tomorrow;
      console.log(`Task date check: ${task.scheduledDateTime} -> ${taskDate.toISOString()} in range: ${inRange}`);
      return inRange;
    });
    
    console.log(`Tasks passing date filter: ${todayTasksFiltered.length}`);
    
    // Simulate hour filtering (with fix)
    const taskSectors = todayTasksFiltered.filter(task => {
      const taskTime = new Date(task.scheduledDateTime);
      const taskHour = taskTime.getHours();
      
      console.log(`Task hour in local time: ${taskHour}`);
      
      // Always show tasks from current 12-hour period
      let inCurrentPeriod = false;
      if (period === 1) {
        inCurrentPeriod = taskHour >= 0 && taskHour < 12;
      } else if (period === 2) {
        inCurrentPeriod = taskHour >= 6 && taskHour < 18;
      } else if (period === 3) {
        inCurrentPeriod = taskHour >= 12 && taskHour < 24;
      } else {
        inCurrentPeriod = taskHour >= 18 || taskHour < 6;
      }
      
      // Also show any tasks from earlier today
      const isEarlierToday = taskTime < currentTime && taskTime.toDateString() === currentTime.toDateString();
      
      console.log(`Period ${period} filter: inCurrentPeriod = ${inCurrentPeriod}, isEarlierToday = ${isEarlierToday}`);
      return inCurrentPeriod || isEarlierToday;
    });
    
    console.log(`Final visible tasks: ${taskSectors.length}`);
    if (taskSectors.length > 0) {
      console.log('✅ Task is VISIBLE');
    } else {
      console.log('❌ Task is HIDDEN');
    }
  });
};

testTaskDisappearance();