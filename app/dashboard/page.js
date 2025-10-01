'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TwelveWeekClock from '@/components/TwelveWeekClock';
import TodayWidget from '@/components/TodayWidget';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LiaGolfBallSolid } from 'react-icons/lia';
import { FaGolfBall } from 'react-icons/fa';
import { TbGolfFilled } from 'react-icons/tb';
import { RiCalendarScheduleFill } from 'react-icons/ri';
import { CgMaximizeAlt } from "react-icons/cg";
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
  const [krTasks, setKrTasks] = useState([]);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [widgetMode, setWidgetMode] = useState('todo'); // 'todo' or 'kr'
  const todoListRef = useRef(null);

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

  useEffect(() => {
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
          setObjectives(transformedObjectives);
          
          // Extract tasks from filtered OKRTs for todo list
          extractTodoTasks(filteredOKRTs, transformedObjectives, colorPalette, timeBlocks);
          
          // Extract KRs from filtered OKRTs for KR list
          extractKRTasks(filteredOKRTs, transformedObjectives, colorPalette);
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

    fetchData();
  }, [router]);

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
    // Filter for tasks with todo or in_progress status
    const tasks = okrts.filter(okrt => 
      okrt.type === 'T' && 
      (okrt.task_status === 'todo' || okrt.task_status === 'in_progress')
    );
    
    console.log('Extracting todo tasks from filtered OKRTs:', tasks.length);
    
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
      if (parentObjective) {
        const foundIndex = transformedObjectives.findIndex(obj => obj.title === (parentObjective.title || parentObjective.description));
        if (foundIndex >= 0) {
          objectiveIndex = foundIndex;
        }
      }
      const color = colorPalette[objectiveIndex % colorPalette.length];
      
      // Check if task is scheduled
      const timeBlock = timeBlocks.find(tb => tb.task_id === task.id);
      const isScheduled = !!timeBlock;
      const scheduledDateTime = isScheduled ? timeBlock.start_time : null;
      
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
    
    // Ensure we have at least 8 tasks for better visual layout
    const minTasks = 8;
    let finalTasks = [...mappedTasks];
    
    // Add sample tasks if we don't have enough
    if (finalTasks.length < minTasks) {
      const sampleTasks = [
        'Set up Azure AD app registration for Microsoft login',
        'Integrate Microsoft login with backend authentication flow', 
        'Test and debug the Microsoft login flow end-to-end',
        'Review and optimize database queries for performance',
        'Update user interface for better mobile responsiveness',
        'Implement error handling for API endpoints',
        'Write unit tests for core application features',
        'Document API endpoints and authentication flow'
      ];
      
      const tasksNeeded = minTasks - finalTasks.length;
      for (let i = 0; i < tasksNeeded; i++) {
        const sampleTaskIndex = i % sampleTasks.length;
        finalTasks.push({
          id: `sample-${i}`,
          taskDescription: sampleTasks[sampleTaskIndex],
          isScheduled: false,
          scheduledDateTime: null,
          scheduledDateFormatted: null,
          color: colorPalette[i % colorPalette.length],
          objectiveIndex: i % colorPalette.length,
          status: 'todo',
          progress: Math.floor(Math.random() * 100), // Random progress for demo
          objectiveTitle: 'Sample Objective',
          krTitle: 'Sample Key Result'
        });
      }
    }
    
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

  // Extract KRs from filtered OKRTs (called during data fetch)
  const extractKRTasks = (okrts, transformedObjectives, colorPalette) => {
    // Filter for Key Results
    const krs = okrts.filter(okrt => okrt.type === 'K');
    
    console.log('Extracting KR tasks from filtered OKRTs:', krs.length);
    
    // Map KRs to display format
    const mappedKRs = krs.map((kr, index) => {
      // Find parent objective
      const parentObjective = okrts.find(okrt => okrt.id === kr.parent_id && okrt.type === 'O');
      
      // Find the objective index for color mapping
      let objectiveIndex = 0;
      if (parentObjective) {
        const foundIndex = transformedObjectives.findIndex(obj => obj.title === (parentObjective.title || parentObjective.description));
        if (foundIndex >= 0) {
          objectiveIndex = foundIndex;
        }
      }
      const color = colorPalette[objectiveIndex % colorPalette.length];
      
      // Format due date if available
      let dueDate = null;
      let dueDateFormatted = "Due date not set";
      if (kr.due_date) {
        dueDate = new Date(kr.due_date);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dueDateFormatted = `${dayNames[dueDate.getDay()]} ${monthNames[dueDate.getMonth()]} ${dueDate.getDate()}`;
      }
      
      return {
        id: kr.id,
        title: kr.title || kr.description,
        dueDate: dueDate,
        dueDateFormatted: dueDateFormatted,
        color: color,
        objectiveIndex: objectiveIndex,
        progress: kr.progress || 0,
        objectiveTitle: parentObjective?.title || parentObjective?.description || 'Unknown Objective'
      };
    });

    // Sort KRs: those with due dates first (by date), then those without
    mappedKRs.sort((a, b) => {
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && b.dueDate) {
        return a.dueDate - b.dueDate;
      }
      return 0;
    });
    
    console.log('Mapped KR tasks for display:', mappedKRs.length);
    
    setKrTasks(mappedKRs);
  };

  // Auto-scroll to show today's and future tasks
  useEffect(() => {
    if (todoTasks.length > 0 && todoListRef.current) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      console.log('Auto-scrolling todo list. Today:', today.toDateString());
      console.log('Total tasks:', todoTasks.length);
      
      // Find the first task that is either unscheduled or scheduled for today/future
      let firstRelevantTaskIndex = -1;
      
      for (let i = 0; i < todoTasks.length; i++) {
        const task = todoTasks[i];
        
        if (!task.isScheduled) {
          // Unscheduled task - this is relevant
          console.log(`Task ${i}: Unscheduled - "${task.taskDescription}" - setting as first relevant`);
          firstRelevantTaskIndex = i;
          break;
        } else {
          // Scheduled task - check if it's today or future
          const taskDate = new Date(task.scheduledDateTime);
          taskDate.setHours(0, 0, 0, 0); // Start of task date
          
          console.log(`Task ${i}: Scheduled for ${taskDate.toDateString()} - "${task.taskDescription}"`);
          
          if (taskDate >= today) {
            // Task is today or in the future
            console.log(`Task ${i}: Is today or future - setting as first relevant`);
            firstRelevantTaskIndex = i;
            break;
          } else {
            console.log(`Task ${i}: Is in the past - skipping`);
          }
        }
      }
      
      console.log('First relevant task index:', firstRelevantTaskIndex);
      
      // If we found a relevant task and it's not already at the top, scroll to show it
      if (firstRelevantTaskIndex > 0) {
        const todoContainer = todoListRef.current;
        const todoItems = todoContainer.children;
        
        if (todoItems[firstRelevantTaskIndex]) {
          // Calculate scroll position to show this task at the top
          const itemHeight = todoItems[0].offsetHeight;
          const scrollPosition = firstRelevantTaskIndex * itemHeight;
          
          console.log(`Scrolling to position ${scrollPosition}px (item ${firstRelevantTaskIndex})`);
          
          // Smooth scroll to position after a small delay to ensure DOM is ready
          setTimeout(() => {
            todoContainer.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          }, 100);
        }
      } else {
        console.log('No scrolling needed - relevant tasks already at top');
      }
    }
  }, [todoTasks]);

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
          {/* Daily Inspiration - Top Left */}
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

          {/* The 12 Week Clock - Top Center */}
          <div className={styles.clockCard}>
            <TwelveWeekClock
              size={getClockSize()}
              dayIndex={dayIndex}
              objectives={objectives}
              colors={clockColors}
              dateLabel={currentDate}
              titlePrefix="Day"
              {...getTrackProps()}
            />
          </div>

          {/* Today Widget - Top Right */}
          <TodayWidget objectives={objectives} todoTasks={todoTasks} />

          {/* Todo/KR Widget - Bottom Left */}
          <div className={`${styles.componentCard} ${styles.todoWidget}`}>
            <div className={styles.componentHeader}>
              <div className={styles.todoHeaderContent}>
                <div className={styles.todoToggle}>
                  <button
                    className={`${styles.todoToggleOption} ${widgetMode === 'todo' ? styles.active : ''}`}
                    onClick={() => setWidgetMode('todo')}
                  >
                    Todo
                  </button>
                  <button
                    className={`${styles.todoToggleOption} ${widgetMode === 'kr' ? styles.active : ''}`}
                    onClick={() => setWidgetMode('kr')}
                  >
                    KR
                  </button>
                </div>
                <button 
                  className={styles.maximizeButton}
                  onClick={() => setTodoModalOpen(true)}
                  title={`Expand ${widgetMode === 'todo' ? 'Todo' : 'KR'} List`}
                >
                  <CgMaximizeAlt />
                </button>
              </div>
            </div>
            <div className={styles.componentContent}>
              <div className={styles.todoList} ref={todoListRef}>
                {widgetMode === 'todo' ? (
                  // Todo Tasks Display
                  todoTasks.length === 0 ? (
                    <div className={styles.emptyTodo}>
                      <p>No tasks available</p>
                    </div>
                  ) : (
                    todoTasks.map((task) => (
                      <div key={task.id} className={styles.todoItem}>
                        <div className={styles.todoIcon}>
                          {task.isScheduled ? (
                            <FaGolfBall style={{ color: task.color, fontSize: '18px' }} />
                          ) : (
                            <LiaGolfBallSolid style={{ color: task.color, fontSize: '18px' }} />
                          )}
                        </div>
                        <div className={styles.todoText}>
                          <div className={styles.todoDescription}>
                            {task.taskDescription}
                          </div>
                          <div className={styles.todoScheduledInfo}>
                            {task.isScheduled && (
                              <>
                                <RiCalendarScheduleFill />
                                <span>{task.scheduledDateFormatted}</span>
                              </>
                            )}
                            <div className={styles.todoProgressContainer}>
                              <div className={styles.todoProgressBar}>
                                <div 
                                  className={styles.todoProgressFill} 
                                  style={{ width: `${task.progress || 0}%` }}
                                />
                              </div>
                              <span className={styles.todoProgressText}>
                                {task.progress || 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  // KR Tasks Display
                  krTasks.length === 0 ? (
                    <div className={styles.emptyTodo}>
                      <p>No key results available</p>
                    </div>
                  ) : (
                    krTasks.map((kr) => (
                      <div key={kr.id} className={styles.todoItem}>
                        <div className={styles.todoIcon}>
                          <TbGolfFilled style={{ color: kr.color, fontSize: '18px' }} />
                        </div>
                        <div className={styles.todoText}>
                          <div className={styles.todoDescription}>
                            {kr.title}
                          </div>
                          <div className={styles.todoScheduledInfo}>
                            <RiCalendarScheduleFill />
                            <span>{kr.dueDateFormatted}</span>
                            <div className={styles.todoProgressContainer}>
                              <div className={styles.todoProgressBar}>
                                <div 
                                  className={styles.todoProgressFill} 
                                  style={{ width: `${kr.progress || 0}%` }}
                                />
                              </div>
                              <span className={styles.todoProgressText}>
                                {kr.progress || 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>

          {/* Activity - Bottom Right */}
          <div className={styles.componentCard}>
            <div className={styles.componentHeader}>
              <h3 className={styles.componentTitle}>Activity</h3>
            </div>
            <div className={styles.componentContent}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Recent Activity</span>
                  <span style={{ color: 'var(--brand-primary)' }}>Today</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }}></div>
                  <span>Dashboard accessed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-secondary)' }}></div>
                  <span>Tasks loaded</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-accent)' }}></div>
                  <span>Progress updated</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Todo Modal */}
      {todoModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setTodoModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{widgetMode === 'todo' ? 'Todo Tasks' : 'Key Results'}</h2>
              <button 
                className={styles.modalCloseButton}
                onClick={() => setTodoModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              {widgetMode === 'todo' ? (
                // Todo Tasks in Modal
                todoTasks.length === 0 ? (
                  <div className={styles.emptyTodo}>
                    <p>No tasks available</p>
                  </div>
                ) : (
                  todoTasks.map((task) => (
                    <div key={task.id} className={styles.modalTodoItem}>
                      <div className={styles.modalTodoIndicator}>
                        {task.status === 'in_progress' ? (
                          <FaGolfBall style={{ color: task.color, fontSize: '18px' }} />
                        ) : (
                          <LiaGolfBallSolid style={{ color: task.color, fontSize: '18px' }} />
                        )}
                      </div>
                      <div className={styles.modalTodoContent}>
                        <div className={styles.modalTodoDescription}>
                          {task.taskDescription}
                        </div>
                        <div className={styles.modalTodoMeta}>
                          {task.isScheduled && (
                            <div className={styles.modalScheduledInfo}>
                              <RiCalendarScheduleFill />
                              <span>{task.scheduledDateFormatted}</span>
                            </div>
                          )}
                          <div className={styles.modalProgressContainer}>
                            <div className={styles.modalProgressBar}>
                              <div 
                                className={styles.modalProgressFill} 
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                            <span className={styles.modalProgressText}>
                              {task.progress || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                // KR Tasks in Modal
                krTasks.length === 0 ? (
                  <div className={styles.emptyTodo}>
                    <p>No key results available</p>
                  </div>
                ) : (
                  krTasks.map((kr) => (
                    <div key={kr.id} className={styles.modalTodoItem}>
                      <div className={styles.modalTodoIndicator}>
                        <TbGolfFilled style={{ color: kr.color, fontSize: '18px' }} />
                      </div>
                      <div className={styles.modalTodoContent}>
                        <div className={styles.modalTodoDescription}>
                          {kr.title}
                        </div>
                        <div className={styles.modalTodoMeta}>
                          <div className={styles.modalScheduledInfo}>
                            <RiCalendarScheduleFill />
                            <span>{kr.dueDateFormatted}</span>
                          </div>
                          <div className={styles.modalProgressContainer}>
                            <div className={styles.modalProgressBar}>
                              <div 
                                className={styles.modalProgressFill} 
                                style={{ width: `${kr.progress || 0}%` }}
                              />
                            </div>
                            <span className={styles.modalProgressText}>
                              {kr.progress || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
                               