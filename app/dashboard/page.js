'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TwelveWeekClock from '@/components/TwelveWeekClock';
import TodayWidget from '@/components/TodayWidget';
import OKRTModal from '@/components/OKRTModal';
import NotificationsWidget from '@/components/NotificationsWidget';
import DailyInspirationCard from '@/components/DailyInspirationCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMainTree } from '@/hooks/useMainTree';
import { useUser } from '@/hooks/useUser';
import useMainTreeStore from '@/store/mainTreeStore';
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
  const { user: session, isLoading: userLoading } = useUser();
  const [objectives, setObjectives] = useState([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todoTasks, setTodoTasks] = useState([]);
  const [filteredOKRTs, setFilteredOKRTs] = useState([]);
  
  // Load mainTree data (will use cached data if available)
  const { isLoading: mainTreeLoading } = useMainTree();
  
  // Zustand store - subscribe to specific sections for progressive rendering
  const myOKRTs = useMainTreeStore((state) => state.mainTree.myOKRTs);
  const timeBlocks = useMainTreeStore((state) => state.mainTree.timeBlocks);
  const notifications = useMainTreeStore((state) => state.mainTree.notifications);
  const sharedOKRTs = useMainTreeStore((state) => state.mainTree.sharedOKRTs);
  const groups = useMainTreeStore((state) => state.mainTree.groups);
  const calendar = useMainTreeStore((state) => state.mainTree.calendar);
  const sectionStates = useMainTreeStore((state) => state.sectionStates);
  const lastUpdated = useMainTreeStore((state) => state.lastUpdated);
  const setError = useMainTreeStore((state) => state.setError);
  
  // OKRT Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    okrt: null,
    parentOkrt: null
  });

  // Responsive size logic
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTabletPortrait = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  const getClockSize = () => {
    if (isMobile) return 280;              // Small screens
    if (isTabletPortrait) return 360;      // Tablet portrait
    return 460;                            // Desktop
  };

  const getTrackProps = () => {
    if (isMobile) return { trackWidth: 8, trackGap: 6 };          // Thinner tracks for mobile
    if (isTabletPortrait) return { trackWidth: 10, trackGap: 8 }; // Medium tracks for tablet
    return { trackWidth: 14, trackGap: 12 };                      // Default thick tracks for desktop
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
      // Calculate day index based on current quarter
      setDayIndex(calculateDayIndex());
      
      // Don't process mainTree here - let the useEffect handle it
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process mainTree data for dashboard display
  const processMainTreeForDashboard = (okrts, timeBlocksData) => {
    // Use provided OKRTs and timeBlocks
    const timeBlocksToUse = timeBlocksData || [];
    
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
    extractTodoTasks(filteredOKRTs, transformedObjectives, colorPalette, timeBlocksToUse);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !session) {
      router.push('/login');
    }
  }, [session, userLoading, router]);

  // Process myOKRTs and timeBlocks whenever they change (progressive rendering)
  useEffect(() => {
    if (session && myOKRTs && myOKRTs.length >= 0) {
      console.log('Processing myOKRTs for dashboard:', myOKRTs.length, 'OKRTs');
      processMainTreeForDashboard(myOKRTs, timeBlocks);
    }
  }, [myOKRTs, timeBlocks, session]);

  // Initial data fetch on mount only
  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // Add window focus listener to refresh data when user comes back to the page
  // But only if the data is stale (older than 5 minutes)
  useEffect(() => {
    const handleFocus = () => {
      if (lastUpdated) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        // Only refetch if data is stale
        if (now - lastUpdateTime >= fiveMinutes) {
          console.log('Window focused with stale data, refreshing dashboard data...');
          fetchData();
        } else {
          console.log('Window focused but data is fresh, skipping refresh');
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [lastUpdated]);

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
    
    // Create a mapped task entry for EACH time block (not just one per task)
    const mappedTasks = [];
    
    tasks.forEach((task) => {
      // Find parent key result
      const parentKR = okrts.find(okrt => okrt.id === task.parent_id && okrt.type === 'K');
      // Find grandparent objective
      const parentObjective = parentKR ?
        okrts.find(okrt => okrt.id === parentKR.parent_id && okrt.type === 'O') :
        null;
      
      // Find ALL time blocks for this task (not just the first one)
      const taskTimeBlocks = timeBlocks.filter(tb => tb.task_id === task.id);
      
      if (taskTimeBlocks.length > 0) {
        // Create a separate entry for each time block
        taskTimeBlocks.forEach((timeBlock) => {
          // Find the objective index for color mapping
          let objectiveIndex = 0;
          let color = colorPalette[0]; // Default color
          
          if (timeBlock.objective_id) {
            // Use objective_id from time block directly
            const foundObjective = transformedObjectives.find(obj => obj.id === timeBlock.objective_id);
            if (foundObjective) {
              const foundIndex = transformedObjectives.indexOf(foundObjective);
              objectiveIndex = foundIndex;
              color = foundObjective.color;
              console.log(`Using objective color from time block: ${task.id} -> objective ${timeBlock.objective_id} -> index ${objectiveIndex} -> color ${color}`);
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
          
          console.log(`Task ${task.id} scheduled at ${timeBlock.start_time}:`, {
            taskDesc: task.description || task.title,
            scheduledDateTime: timeBlock.start_time,
            formatted: formatScheduledDateTime(timeBlock.start_time)
          });
          
          mappedTasks.push({
            id: task.id,
            timeBlockId: timeBlock.id, // Add time block ID to distinguish multiple schedules
            taskDescription: task.description || task.title,
            isScheduled: true,
            scheduledDateTime: timeBlock.start_time,
            duration: timeBlock.duration,
            scheduledDateFormatted: formatScheduledDateTime(timeBlock.start_time),
            color: color,
            objectiveIndex: objectiveIndex,
            status: task.task_status,
            progress: task.progress || 0,
            objectiveTitle: parentObjective?.title || parentObjective?.description || 'Unknown Objective',
            krTitle: parentKR?.title || parentKR?.description || 'Unknown KR',
            objective: parentObjective?.title || parentObjective?.description,
            keyResult: parentKR?.title || parentKR?.description
          });
        });
      } else {
        // Task has no time blocks - add as unscheduled
        let objectiveIndex = 0;
        let color = colorPalette[0];
        
        if (parentObjective) {
          const foundIndex = transformedObjectives.findIndex(obj => obj.id === parentObjective.id);
          if (foundIndex >= 0) {
            objectiveIndex = foundIndex;
            color = transformedObjectives[foundIndex].color;
          }
        }
        
        mappedTasks.push({
          id: task.id,
          taskDescription: task.description || task.title,
          isScheduled: false,
          scheduledDateTime: null,
          duration: null,
          scheduledDateFormatted: null,
          color: color,
          objectiveIndex: objectiveIndex,
          status: task.task_status,
          progress: task.progress || 0,
          objectiveTitle: parentObjective?.title || parentObjective?.description || 'Unknown Objective',
          krTitle: parentKR?.title || parentKR?.description || 'Unknown KR',
          objective: parentObjective?.title || parentObjective?.description,
          keyResult: parentKR?.title || parentKR?.description
        });
      }
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



  if (userLoading) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className="app-pageContent app-pageContent--full">
          <div className={styles.content}>
            <div className={styles.loading}>Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }
  
  // Check which sections are available for progressive rendering
  const hasMyOKRTs = sectionStates.myOKRTs.loaded;
  const hasTimeBlocks = sectionStates.timeBlocks.loaded;
  const hasNotifications = sectionStates.notifications.loaded;
  const hasSharedOKRTs = sectionStates.sharedOKRTs.loaded;
  const hasGroups = sectionStates.groups.loaded;
  const hasCalendar = sectionStates.calendar.loaded;

  const currentDate = formatCurrentDate();

  // Render layout based on screen size with progressive rendering
  const renderMobileLayout = () => (
    <>
      {/* 1. 12 Week Clock - depends on myOKRTs and timeBlocks */}
      {hasMyOKRTs && hasTimeBlocks ? (
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
              okrts={filteredOKRTs}
              {...getTrackProps()}
            />
          </div>
        </div>
      ) : (
        <div className={styles.column}>
          <div className={styles.clockCard}>
            <div className={styles.loading}>Loading clock...</div>
          </div>
        </div>
      )}

      {/* 2. Daily Inspiration - always render */}
      <div className={styles.column}>
        <DailyInspirationCard />
      </div>

      {/* 3. Today Widget - depends on myOKRTs and timeBlocks */}
      {hasMyOKRTs && hasTimeBlocks ? (
        <div className={styles.column}>
          <TodayWidget objectives={objectives} todoTasks={todoTasks} />
        </div>
      ) : (
        <div className={styles.column}>
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading tasks...</div>
          </div>
        </div>
      )}

      {/* 4. Notifications - depends on notifications */}
      {hasNotifications ? (
        <div className={styles.column}>
          <div className={styles.componentCard}>
            <div className={styles.componentHeader}>
              <h3 className={styles.componentTitle}>Notifications</h3>
            </div>
            <div className={styles.componentContent}>
              <NotificationsWidget />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.column}>
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading notifications...</div>
          </div>
        </div>
      )}
    </>
  );

  const renderTabletPortraitLayout = () => (
    <>
      {/* Column 1: Daily Inspiration + Today Clock (40%) */}
      <div className={styles.column}>
        <DailyInspirationCard />
        {hasMyOKRTs && hasTimeBlocks ? (
          <TodayWidget objectives={objectives} todoTasks={todoTasks} />
        ) : (
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading tasks...</div>
          </div>
        )}
      </div>

      {/* Column 2: 12 Week Clock + Notifications (60%) */}
      <div className={styles.column}>
        {hasMyOKRTs && hasTimeBlocks ? (
          <div className={styles.clockCard}>
            <TwelveWeekClock
              size={getClockSize()}
              dayIndex={dayIndex}
              objectives={objectives}
              colors={clockColors}
              dateLabel={currentDate}
              titlePrefix="Day"
              onCreateObjective={handleCreateObjective}
              okrts={filteredOKRTs}
              {...getTrackProps()}
            />
          </div>
        ) : (
          <div className={styles.clockCard}>
            <div className={styles.loading}>Loading clock...</div>
          </div>
        )}
        {hasNotifications ? (
          <div className={styles.componentCard}>
            <div className={styles.componentHeader}>
              <h3 className={styles.componentTitle}>Notifications</h3>
            </div>
            <div className={styles.componentContent}>
              <NotificationsWidget />
            </div>
          </div>
        ) : (
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading notifications...</div>
          </div>
        )}
      </div>
    </>
  );

  const renderDesktopLayout = () => (
    <>
      {/* Column 1: Daily Inspiration + Notifications (33%) */}
      <div className={styles.column}>
        <DailyInspirationCard />
        {hasNotifications ? (
          <div className={styles.componentCard}>
            <div className={styles.componentHeader}>
              <h3 className={styles.componentTitle}>Notifications</h3>
            </div>
            <div className={styles.componentContent}>
              <NotificationsWidget />
            </div>
          </div>
        ) : (
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading notifications...</div>
          </div>
        )}
      </div>

      {/* Column 2: 12 Week Clock (33%) */}
      <div className={styles.column}>
        {hasMyOKRTs && hasTimeBlocks ? (
          <div className={styles.clockCard}>
            <TwelveWeekClock
              size={getClockSize()}
              dayIndex={dayIndex}
              objectives={objectives}
              colors={clockColors}
              dateLabel={currentDate}
              titlePrefix="Day"
              onCreateObjective={handleCreateObjective}
              okrts={filteredOKRTs}
              {...getTrackProps()}
            />
          </div>
        ) : (
          <div className={styles.clockCard}>
            <div className={styles.loading}>Loading clock...</div>
          </div>
        )}
      </div>

      {/* Column 3: Today Widget (33%) */}
      <div className={styles.column}>
        {hasMyOKRTs && hasTimeBlocks ? (
          <TodayWidget objectives={objectives} todoTasks={todoTasks} />
        ) : (
          <div className={styles.componentCard}>
            <div className={styles.loading}>Loading tasks...</div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`app-page ${styles.container}`}>
      <div className="app-pageContent app-pageContent--full">
        <div className={styles.content}>
          <div className={styles.dashboardGrid}>
            {isMobile ? renderMobileLayout() : isTabletPortrait ? renderTabletPortraitLayout() : renderDesktopLayout()}
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
                               
