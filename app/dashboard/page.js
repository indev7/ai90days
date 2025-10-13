'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TwelveWeekClock from '@/components/TwelveWeekClock';
import TodayWidget from '@/components/TodayWidget';
import OKRTModal from '@/components/OKRTModal';
import OKRTs from '@/components/OKRTs';
import NotificationsWidget from '@/components/NotificationsWidget';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  transformOKRTsToObjectives,
  calculateDayIndex,
  getClockColors,
  formatCurrentDate,
  getThemeColorPalette,
  getCurrentQuarterInfo
} from '@/lib/clockUtils';
import styles from './page.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todoTasks, setTodoTasks] = useState([]);
  const [filteredOKRTs, setFilteredOKRTs] = useState([]);
  
  // OKRT Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    okrt: null,
    parentOkrt: null
  });

  // Responsive size logic
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const getClockSize = () => {
    if (isMobile) return 280;        // Small screens
    if (isTablet) return 360;        // Medium screens
    return 460;                      // Large screens (desktop)
  };

  const getTrackProps = () => {
    if (isMobile) return { trackWidth: 8, trackGap: 6 };   // Thinner tracks for mobile
    if (isTablet) return { trackWidth: 10, trackGap: 8 };  // Medium tracks for tablet
    return { trackWidth: 14, trackGap: 12 };               // Default thick tracks for desktop
  };

  // Use original prototype colors
  const clockColors = {
    face: '#f7fbff',
    elapsedFill: '#e8f0ff',
    ticksAndText: '#111',
    tracksBg: '#e5e5e5',
    hand: '#bfbfbf'
  };

  const fetchData = async () => {
    try {
      // Get session via API
      const sessionResponse = await fetch('/api/me');
      if (!sessionResponse.ok) {
        router.push('/login');
        return;
      }
      const sessionData = await sessionResponse.json();
      setSession(sessionData.user);

      // Get user's OKRTs via API
      const okrtsResponse = await fetch('/api/okrt');
      let timeBlocks = [];
      if (okrtsResponse.ok) {
        const okrtsData = await okrtsResponse.json();
        const okrts = okrtsData.okrts || [];
        
        // Get user's time blocks
        const timeBlocksResponse = await fetch('/api/time-blocks');
        if (timeBlocksResponse.ok) {
          const timeBlocksData = await timeBlocksResponse.json();
          timeBlocks = timeBlocksData.timeBlocks || [];
          console.log(`Fetched ${timeBlocks.length} time blocks:`, timeBlocks);
        }
          
          // Get current quarter info for filtering
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1; // 1-12
          const currentQuarter = Math.ceil(currentMonth / 3);
          
          // Format current quarter - support both "2025Q4" and "2025-Q4" formats
          const currentCycleQtr1 = `${currentYear}Q${currentQuarter}`;
          const currentCycleQtr2 = `${currentYear}-Q${currentQuarter}`;
          
          console.log('Filtering objectives for current quarter:', currentCycleQtr1, 'or', currentCycleQtr2);
          
          // Filter OKRTs to only include current quarter objectives and their children
          const currentQuarterObjectives = okrts.filter(okrt => 
            okrt.type === 'O' && 
            (okrt.cycle_qtr === currentCycleQtr1 || okrt.cycle_qtr === currentCycleQtr2)
          );
          
          const objectiveIds = currentQuarterObjectives.map(obj => obj.id);
          console.log('Current quarter objective IDs:', objectiveIds);
          
          // Include objectives and all their children (KRs and Tasks)
          const filteredOKRTs = okrts.filter(okrt => {
            if (okrt.type === 'O') {
              // Only include objectives from current quarter
              return okrt.cycle_qtr === currentCycleQtr1 || okrt.cycle_qtr === currentCycleQtr2;
            } else {
              // For KRs and Tasks, include if they belong to current quarter objectives
              return objectiveIds.includes(okrt.parent_id) || 
                     okrts.some(parent => 
                       parent.id === okrt.parent_id && 
                       objectiveIds.includes(parent.parent_id)
                     );
            }
          });
          
          console.log('Filtered OKRTs for current quarter:', filteredOKRTs.length, 'out of', okrts.length);
          
          // Transform filtered OKRTs to objectives format
          const colorPalette = getThemeColorPalette();
          const transformedObjectives = transformOKRTsToObjectives(filteredOKRTs, colorPalette);
          console.log('Dashboard transformed objectives:', transformedObjectives.map((obj, index) => ({
            id: obj.id,
            title: obj.title,
            created_at: obj.created_at,
            index: index,
            color: obj.color
          })));
          setObjectives(transformedObjectives);
          
          // Add color information to filtered OKRTs for tree display
          const okrtsWithColors = filteredOKRTs.map(okrt => {
            if (okrt.type === 'O') {
              const foundObj = transformedObjectives.find(obj => obj.id === okrt.id);
              return { ...okrt, color: foundObj?.color || colorPalette[0] };
            }
            return okrt;
          });
          setFilteredOKRTs(okrtsWithColors);
          
          // Extract tasks from filtered OKRTs for todo list (used by TodayWidget)
          extractTodoTasks(filteredOKRTs, transformedObjectives, colorPalette, timeBlocks);
        }
        
        // Calculate day index based on current quarter
        setDayIndex(calculateDayIndex());
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [router]);

  // Add window focus listener to refresh data when user comes back to the page
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, refreshing dashboard data...');
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Helper function to format date and time
  const formatScheduledDateTime = (startTime) => {
    const date = new Date(startTime);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${dayName} ${displayHours}:${displayMinutes}${ampm}`;
  };

  // Extract todo tasks from filtered OKRTs (called during data fetch)
  const extractTodoTasks = (okrts, transformedObjectives, colorPalette, timeBlocks = []) => {
    // Filter for all tasks (including done and blocked for schedule display)
    const tasks = okrts.filter(okrt => 
      okrt.type === 'T'
    );
    
    console.log('Extracting all tasks from filtered OKRTs:', tasks.length);
    console.log('Available tasks:', tasks.map(t => ({ id: t.id, title: t.title || t.description })));
    console.log('Available time blocks:', timeBlocks.map(tb => ({ task_id: tb.task_id, start_time: tb.start_time, duration: tb.duration })));
    
    // Map tasks to include color from objectives and scheduling info
    const mappedTasks = tasks.map((task, index) => {
      // Find parent key result
      const parentKR = okrts.find(okrt => okrt.id === task.parent_id && okrt.type === 'K');
      // Find grandparent objective
      const parentObjective = parentKR ? 
        okrts.find(okrt => okrt.id === parentKR.parent_id && okrt.type === 'O') : 
        null;
      
      // Find the objective index for color mapping
      let objectiveIndex = 0;
      let color = colorPalette[0]; // Default color
      
      // Check if task has time blocks with objective_id for color mapping
      const taskTimeBlock = timeBlocks.find(tb => tb.task_id === task.id);
      if (taskTimeBlock && taskTimeBlock.objective_id) {
        // Use objective_id from time block directly
        const foundObjective = transformedObjectives.find(obj => obj.id === taskTimeBlock.objective_id);
        if (foundObjective) {
          const foundIndex = transformedObjectives.indexOf(foundObjective);
          objectiveIndex = foundIndex;
          color = foundObjective.color;
          console.log(`Using objective color from time block: ${task.id} -> objective ${taskTimeBlock.objective_id} -> index ${objectiveIndex} -> color ${color}`);
        }
      } else if (parentObjective) {
        // Fallback to deriving from task hierarchy
        const foundIndex = transformedObjectives.findIndex(obj => obj.id === parentObjective.id);
        if (foundIndex >= 0) {
          objectiveIndex = foundIndex;
          color = transformedObjectives[foundIndex].color;
          console.log(`Using objective color from hierarchy: ${task.id} -> objective ${parentObjective.id} -> index ${objectiveIndex} -> color ${color}`);
        }
      }
      
      // Check if task is scheduled
      const timeBlock = taskTimeBlock;
      const isScheduled = !!timeBlock;
      const scheduledDateTime = isScheduled ? timeBlock.start_time : null;
      
      // Debug log for all tasks and their scheduling status
      console.log(`Task ${task.id} (${task.description || task.title}):`, {
        isScheduled,
        timeBlockFound: !!timeBlock,
        scheduledDateTime,
        timeBlockTaskId: timeBlock?.task_id
      });
      
      // Debug log for scheduled tasks
      if (isScheduled) {
        console.log(`Task ${task.id} is scheduled:`, {
          taskDesc: task.description || task.title,
          scheduledDateTime,
          formatted: formatScheduledDateTime(scheduledDateTime)
        });
      }
      
      return {
        id: task.id,
        taskDescription: task.description || task.title,
        isScheduled: isScheduled,
        scheduledDateTime: scheduledDateTime,
        duration: isScheduled ? timeBlock.duration : null,
        scheduledDateFormatted: isScheduled ? formatScheduledDateTime(scheduledDateTime) : null,
        color: color,
        objectiveIndex: objectiveIndex,
        status: task.task_status,
        progress: task.progress || 0,
        objectiveTitle: parentObjective?.title || parentObjective?.description || 'Unknown Objective',
        krTitle: parentKR?.title || parentKR?.description || 'Unknown KR'
      };
    });

    // Sort tasks: scheduled tasks first (by date/time), then unscheduled tasks
    mappedTasks.sort((a, b) => {
      if (a.isScheduled && !b.isScheduled) return -1; // a comes first
      if (!a.isScheduled && b.isScheduled) return 1;  // b comes first
      if (a.isScheduled && b.isScheduled) {
        // Both scheduled, sort by date/time
        return new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime);
      }
      // Both unscheduled, maintain original order
      return 0;
    });
    
    console.log('Mapped current quarter tasks for display:', mappedTasks.length);
    
    let finalTasks = [...mappedTasks];
    
    // Sort final tasks list: scheduled first, then unscheduled
    finalTasks.sort((a, b) => {
      if (a.isScheduled && !b.isScheduled) return -1;
      if (!a.isScheduled && b.isScheduled) return 1;
      if (a.isScheduled && b.isScheduled) {
        return new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime);
      }
      return 0;
    });
    
    setTodoTasks(finalTasks);
  };

  // Modal handlers
  const handleCreateObjective = () => {
    setModalState({
      isOpen: true,
      mode: 'create',
      okrt: null,
      parentOkrt: null
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: 'create',
      okrt: null,
      parentOkrt: null
    });
  };

  const handleSaveOkrt = async (okrtData) => {
    try {
      const response = await fetch('/api/okrt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(okrtData),
      });

      if (!response.ok) {
        throw new Error('Failed to save OKRT');
      }

      // Refresh the dashboard data
      await fetchData();
      
      // Close the modal
      handleCloseModal();
    } catch (error) {
      console.error('Error saving OKRT:', error);
      // You might want to show an error message to the user here
    }
  };



  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loading}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  const currentDate = formatCurrentDate();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.dashboardGrid}>
          {/* Column 1: Daily Inspiration + Todo List */}
          <div className={styles.column}>
            {/* Daily Inspiration */}
            <div className={styles.componentCard}>
              <div className={styles.componentHeader}>
                <h3 className={styles.componentTitle}>Daily Inspiration</h3>
              </div>
              <div className={styles.componentContent}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%', 
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic'
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', textAlign: 'center' }}>
                    "Success is the sum of small efforts repeated day in and day out."
                  </p>
                  <small>— Robert Collier</small>
                </div>
              </div>
            </div>

            {/* OKRTs Widget */}
            <div className={`${styles.componentCard} ${styles.todoWidget}`}>
              <div className={styles.componentHeader}>
                <h3 className={styles.componentTitle}>OKRTs</h3>
              </div>
              <div className={styles.componentContent}>
                <OKRTs okrts={filteredOKRTs} />
              </div>
            </div>
          </div>

          {/* Column 2: 12 Week Clock */}
          <div className={styles.column}>
            <div className={styles.clockCard}>
              <TwelveWeekClock
                size={getClockSize()}
                dayIndex={dayIndex}
                objectives={objectives}
                colors={clockColors}
                dateLabel={currentDate}
                titlePrefix="Day"
                onCreateObjective={handleCreateObjective}
                {...getTrackProps()}
              />
            </div>
          </div>

          {/* Column 3: Today Widget + Activity */}
          <div className={styles.column}>
            {/* Today Widget */}
            <TodayWidget objectives={objectives} todoTasks={todoTasks} />

            {/* Notifications */}
            <div className={styles.componentCard}>
              <div className={styles.componentHeader}>
                <h3 className={styles.componentTitle}>Notifications</h3>
              </div>
              <div className={styles.componentContent}>
                <NotificationsWidget />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* OKRT Modal */}
      <OKRTModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOkrt}
        okrt={modalState.okrt}
        parentOkrt={modalState.parentOkrt}
        mode={modalState.mode}
      />
    </div>
  );
}
                               