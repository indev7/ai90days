'use client';

import { useState } from 'react';
import TodayClock from './TodayClock';
import TaskUpdateModal from './TaskUpdateModal';
import styles from './TodayWidget.module.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function TodayWidget({ objectives, todoTasks }) {
  const currentDate = new Date();
  
  // Generate time range subtitle based on current period
  const getTimeRangeSubtitle = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Determine current period and time range
    let startTime, endTime, startDate, endDate;
    
    if (currentHour >= 0 && currentHour < 6) {
      // Period 1: 12:00 AM - 5:59 AM → Shows 12:00 AM to 11:59 AM
      startTime = "12AM";
      endTime = "12PM";
      startDate = new Date(now);
      endDate = new Date(now);
    } else if (currentHour >= 6 && currentHour < 12) {
      // Period 2: 6:00 AM - 11:59 AM → Shows 6:00 AM to 5:59 PM
      startTime = "6AM";
      endTime = "6PM";
      startDate = new Date(now);
      endDate = new Date(now);
    } else if (currentHour >= 12 && currentHour < 18) {
      // Period 3: 12:00 PM - 5:59 PM → Shows 12:00 PM to 11:59 PM
      startTime = "12PM";
      endTime = "12AM";
      startDate = new Date(now);
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      // Period 4: 6:00 PM - 11:59 PM → Shows 6:00 PM to 5:59 AM next day
      startTime = "6PM";
      endTime = "6AM";
      startDate = new Date(now);
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 1);
    }
    
    // Format dates
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = dayNames[startDate.getDay()];
    const endDay = dayNames[endDate.getDay()];
    const startDayNum = startDate.getDate();
    const endDayNum = endDate.getDate();
    
    return `Schedule ${startDay} ${startDayNum}, ${startTime} - ${endDay} ${endDayNum}, ${endTime}`;
  };

  const timeRangeSubtitle = getTimeRangeSubtitle();

  // Task Update Modal State
  const [taskUpdateModalState, setTaskUpdateModalState] = useState({
    isOpen: false,
    task: null
  });

  // Responsive clock sizing to fill available area
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const getTodayClockSize = () => {
    if (isMobile) return 220; // Smaller for mobile
    if (isTablet) return 200; // Medium for tablet
    return 260; // Larger for desktop to fill the available space better
  };

  // Task click handler
  const handleTaskClick = (task) => {
    setTaskUpdateModalState({
      isOpen: true,
      task: task
    });
  };

  // Modal handlers
  const handleCloseTaskUpdateModal = () => {
    setTaskUpdateModalState({
      isOpen: false,
      task: null
    });
  };

  const handleSaveTaskUpdate = async (taskId, updateData) => {
    try {
      console.log('Saving task update from TodayWidget:', { taskId, updateData });
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      const result = await response.json();
      console.log('Task update result:', result);

      // Close modal
      handleCloseTaskUpdateModal();

      // Show success message if progress was propagated
      if (result.propagation) {
        console.log('Progress propagated:', result.propagation);
      }

      // Note: You might want to refresh data here if needed
      // This depends on how your parent component manages data refresh

    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  return (
    <>
      <div className={styles.componentCard}>
        <div className={styles.componentHeader}>
          <h3 className={styles.componentTitle}>{timeRangeSubtitle}</h3>
        </div>
        <div className={styles.componentContent}>
          <TodayClock 
            todoTasks={todoTasks} 
            size={getTodayClockSize()} 
            onTaskClick={handleTaskClick}
          />
        </div>
      </div>

      {/* Task Update Modal */}
      <TaskUpdateModal
        isOpen={taskUpdateModalState.isOpen}
        onClose={handleCloseTaskUpdateModal}
        task={taskUpdateModalState.task}
        onSave={handleSaveTaskUpdate}
      />
    </>
  );
}

