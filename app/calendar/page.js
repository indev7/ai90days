'use client';

import { useState, useEffect, useCallback } from 'react';
import { GrTrophy } from 'react-icons/gr';
import { GiGolfFlag } from "react-icons/gi";
import { LiaGolfBallSolid } from "react-icons/lia";
import styles from './page.module.css';

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 300, label: '5h' },
  { value: 360, label: '6h' },
  { value: 480, label: '8h' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: 'All day' }
];

// Generate time slots from 4AM to 11PM
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 4; hour <= 23; hour++) {
    slots.push({
      hour,
      display: hour === 12 ? '12:00 PM' : 
               hour === 0 ? '12:00 AM' :
               hour < 12 ? `${hour}:00 AM` : 
               `${hour - 12}:00 PM`
    });
  }
  return slots;
};

const getDaysOfWeek = (currentDate) => {
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  startOfWeek.setDate(diff);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    days.push({
      date: new Date(date),
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate()
    });
  }
  return days;
};

const formatTimeSlotId = (dayIndex, hour) => `${dayIndex}-${hour}`;

export default function CalendarPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    const monday = new Date(today);
    monday.setDate(diff);
    return monday.toISOString().split('T')[0]; // Store as string
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [timeBlocks, setTimeBlocks] = useState([]);
  const [taskHierarchy, setTaskHierarchy] = useState([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [mobileCurrentDay, setMobileCurrentDay] = useState(0); // Index for mobile view
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const timeSlots = generateTimeSlots();
  const currentDate = new Date(currentWeekStart);
  const daysOfWeek = getDaysOfWeek(currentDate);

  // Fetch time blocks for the current week
  const fetchTimeBlocks = useCallback(async () => {
    try {
      const weekStart = new Date(currentWeekStart);
      const currentDays = getDaysOfWeek(weekStart);
      
      // Fetch time blocks for each day of the week
      const promises = currentDays.map(day => {
        const dateStr = day.date.toISOString().split('T')[0];
        return fetch(`/api/time-blocks?date=${dateStr}`)
          .then(res => res.json())
          .then(data => ({ date: dateStr, blocks: data.timeBlocks || [] }));
      });
      
      const results = await Promise.all(promises);
      const allBlocks = results.flatMap(result => 
        result.blocks.map(block => ({
          ...block,
          date: result.date
        }))
      );
      
      setTimeBlocks(allBlocks);
    } catch (error) {
      console.error('Error fetching time blocks:', error);
    }
  }, [currentWeekStart]);

  // Fetch available tasks hierarchy for scheduling - only fetch once on mount
  useEffect(() => {
    const fetchTaskHierarchy = async () => {
      try {
        const response = await fetch('/api/time-blocks/tasks');
        if (response.ok) {
          const data = await response.json();
          setTaskHierarchy(data.hierarchy || []);
        }
      } catch (error) {
        console.error('Error fetching task hierarchy:', error);
      }
    };

    fetchTaskHierarchy();
  }, []);

  useEffect(() => {
    fetchTimeBlocks();
  }, [fetchTimeBlocks]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest(`.${styles.customDropdown}`)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleTimeSlotClick = (dayIndex, hour) => {
    const slotId = formatTimeSlotId(dayIndex, hour);
    if (selectedTimeSlot === slotId) {
      setSelectedTimeSlot(null);
    } else {
      setSelectedTimeSlot(slotId);
    }
  };

  const handleTimeSlotDoubleClick = (dayIndex, hour) => {
    const slotId = formatTimeSlotId(dayIndex, hour);
    setSelectedTimeSlot(slotId);
    setShowScheduleModal(true);
  };

  const handleSchedule = async () => {
    if (!selectedTask || !selectedTimeSlot) return;

    const [dayIndex, hour] = selectedTimeSlot.split('-').map(Number);
    const selectedDay = daysOfWeek[dayIndex];
    const startTime = new Date(selectedDay.date);
    startTime.setHours(hour, 0, 0, 0);

    setLoading(true);
    try {
      const response = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: selectedTask,
          start_time: startTime.toISOString(),
          duration: selectedDuration
        })
      });

      if (response.ok) {
        resetModal();
        await fetchTimeBlocks(); // Refresh time blocks
      } else {
        console.error('Error creating time block');
      }
    } catch (error) {
      console.error('Error scheduling task:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate.toISOString().split('T')[0]);
  };

  const navigateMobileDay = (direction) => {
    const newIndex = mobileCurrentDay + direction;
    if (newIndex >= 0 && newIndex < 7) {
      setMobileCurrentDay(newIndex);
    }
  };

  const getTimeBlocksForSlot = (dayIndex, hour) => {
    const selectedDay = daysOfWeek[dayIndex];
    const dateStr = selectedDay.date.toISOString().split('T')[0];
    
    return timeBlocks.filter(block => {
      const blockStart = new Date(block.start_time);
      const blockHour = blockStart.getHours();
      return block.date === dateStr && blockHour === hour;
    });
  };

  const formatDuration = (minutes) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const handleTaskSelect = (taskId, taskTitle) => {
    setSelectedTask(taskId);
    setSelectedTaskTitle(taskTitle);
    setDropdownOpen(false);
  };

  const resetModal = () => {
    setShowScheduleModal(false);
    setSelectedTimeSlot(null);
    setSelectedTask('');
    setSelectedTaskTitle('');
    setSelectedDuration(30);
    setDropdownOpen(false);
  };

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <h1 className={styles.calendarTitle}>Calendar</h1>
        <div className={styles.navigationControls}>
          <button 
            className={styles.navButton}
            onClick={() => navigateWeek(-1)}
          >
            Previous Week
          </button>
          <button 
            className={styles.navButton}
            onClick={() => {
              const today = new Date();
              const day = today.getDay();
              const diff = today.getDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(today);
              monday.setDate(diff);
              setCurrentWeekStart(monday.toISOString().split('T')[0]);
            }}
          >
            Today
          </button>
          <button 
            className={styles.navButton}
            onClick={() => navigateWeek(1)}
          >
            Next Week
          </button>
        </div>
      </div>

      <div className={styles.calendarContent}>
        {/* Desktop Calendar Grid */}
        <div className={styles.calendarGrid}>
          <div className={styles.timeColumn}>
            <div className={styles.dayHeader}></div>
            {timeSlots.map((slot) => (
              <div key={slot.hour} className={styles.timeSlot}>
                {slot.display}
              </div>
            ))}
          </div>

          {daysOfWeek.map((day, dayIndex) => (
            <div key={dayIndex} className={styles.dayColumn}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>{day.name}</div>
                <div className={styles.dayDate}>{day.dayNumber}</div>
              </div>
              
              {timeSlots.map((slot) => {
                const slotId = formatTimeSlotId(dayIndex, slot.hour);
                const isSelected = selectedTimeSlot === slotId;
                const blocksInSlot = getTimeBlocksForSlot(dayIndex, slot.hour);
                
                return (
                  <div
                    key={slot.hour}
                    className={`${styles.timeSlotCell} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleTimeSlotClick(dayIndex, slot.hour)}
                    onDoubleClick={() => handleTimeSlotDoubleClick(dayIndex, slot.hour)}
                  >
                    {isSelected && (
                      <button 
                        className={styles.scheduleButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowScheduleModal(true);
                        }}
                      >
                        Schedule
                      </button>
                    )}
                    
                    {blocksInSlot.map((block) => (
                      <div key={block.id} className={styles.timeBlock}>
                        <div className={styles.timeBlockTitle}>
                          {block.task_title || block.task_description || `Task ${block.task_id}`}
                        </div>
                        <div className={styles.timeBlockDuration}>
                          {formatDuration(block.duration)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Mobile Calendar View */}
        <div className={styles.mobileCalendar}>
          <div className={styles.mobileDayView}>
            <div className={styles.mobileDayHeader}>
              <button 
                className={styles.navButton}
                onClick={() => navigateMobileDay(-1)}
                disabled={mobileCurrentDay === 0}
              >
                ←
              </button>
              <div className={styles.mobileDayTitle}>
                {daysOfWeek[mobileCurrentDay].name}, {daysOfWeek[mobileCurrentDay].dayNumber}
              </div>
              <button 
                className={styles.navButton}
                onClick={() => navigateMobileDay(1)}
                disabled={mobileCurrentDay === 6}
              >
                →
              </button>
            </div>

            <div className={styles.mobileTimeSlots}>
              {timeSlots.map((slot) => {
                const slotId = formatTimeSlotId(mobileCurrentDay, slot.hour);
                const isSelected = selectedTimeSlot === slotId;
                const blocksInSlot = getTimeBlocksForSlot(mobileCurrentDay, slot.hour);
                
                return (
                  <div key={slot.hour} className={styles.mobileTimeSlot}>
                    <div className={styles.mobileTimeLabel}>
                      {slot.display}
                    </div>
                    <div
                      className={`${styles.mobileTimeContent} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleTimeSlotClick(mobileCurrentDay, slot.hour)}
                      onDoubleClick={() => handleTimeSlotDoubleClick(mobileCurrentDay, slot.hour)}
                    >
                      {isSelected && (
                        <button 
                          className={styles.scheduleButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowScheduleModal(true);
                          }}
                        >
                          Schedule
                        </button>
                      )}
                      
                      {blocksInSlot.map((block) => (
                        <div key={block.id} className={styles.timeBlock}>
                          <div className={styles.timeBlockTitle}>
                            {block.task_title || block.task_description || `Task ${block.task_id}`}
                          </div>
                          <div className={styles.timeBlockDuration}>
                            {formatDuration(block.duration)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className={styles.modalOverlay} onClick={resetModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>Schedule Task</div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Task</label>
              <div className={styles.customDropdown}>
                <button
                  type="button"
                  className={styles.dropdownButton}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <span>{selectedTaskTitle || 'Select a task...'}</span>
                  <span className={`${styles.dropdownArrow} ${dropdownOpen ? styles.open : ''}`}>
                    ▼
                  </span>
                </button>
                
                {dropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    {taskHierarchy.map((objective) => (
                      <div key={objective.id}>
                        <div className={`${styles.hierarchyItem} ${styles.objective}`}>
                          <GrTrophy size={16} /> {objective.title}
                        </div>
                        {objective.keyResults.map((keyResult) => (
                          <div key={keyResult.id}>
                            <div className={`${styles.hierarchyItem} ${styles.keyResult}`}>
                              <GiGolfFlag size={16} /> {keyResult.title}
                            </div>
                            {keyResult.tasks.map((task) => (
                              <div
                                key={task.id}
                                className={`${styles.hierarchyItem} ${styles.task} ${
                                  selectedTask === task.id ? styles.selected : ''
                                }`}
                                onClick={() => handleTaskSelect(task.id, task.title)}
                              >
                                <LiaGolfBallSolid size={16} /> {task.title}
                                <span className={styles.taskStatus}>
                                  ({task.task_status})
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                    {taskHierarchy.length === 0 && (
                      <div className={`${styles.hierarchyItem} ${styles.task}`}>
                        No tasks available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Allocate</label>
              <select
                className={styles.formSelect}
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                onClick={resetModal}
              >
                Cancel
              </button>
              <button
                className={`${styles.modalButton} ${styles.modalButtonCreate}`}
                onClick={handleSchedule}
                disabled={!selectedTask || loading}
              >
                {loading ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}