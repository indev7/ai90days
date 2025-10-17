'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './TodayClock.module.css';

export default function TodayClock({ todoTasks, size = 200, onTaskClick }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();
  
  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Cleanup timer on component unmount
    return () => clearInterval(timer);
  }, []);
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentSecond = currentTime.getSeconds();
  
  /*
   * CLOCK FACE TIME PERIOD DISPLAY LOGIC
   * ====================================
   * 
   * The clock face displays a rolling 12-hour window that advances every 6 hours.
   * This ensures users always see current and upcoming tasks within a reasonable timeframe.
   * 
   * Time Period Breakpoints & Task Display:
   * 
   * Current Time Range        → Clock Face Shows Tasks For
   * ─────────────────────────────────────────────────────────
   * 12:00 AM - 5:59 AM       → 12:00 AM to 11:59 AM (12-hour window)
   * 6:00 AM - 11:59 AM       → 6:00 AM to 5:59 PM (12-hour window)
   * 12:00 PM - 5:59 PM       → 12:00 PM to 11:59 PM (12-hour window)
   * 6:00 PM - 11:59 PM       → 6:00 PM to 5:59 AM next day (12-hour window)
   * 
   * Sun/Moon Icon Changes at: 6:00 AM, 12:00 PM (noon), and 6:00 PM
   * Task Display Changes at: 6:00 AM, 12:00 PM (noon), 6:00 PM, and 12:00 AM (midnight)
   */
  
  // Determine current 6-hour period and corresponding 12-hour task range
  const getCurrentPeriod = () => {
    if (currentHour >= 0 && currentHour < 6) {
      return {
        period: 1,
        taskRangeStart: 0,  // 12AM
        taskRangeEnd: 12,   // 12PM
        sunLeft: true,
        moonRight: true
      };
    } else if (currentHour >= 6 && currentHour < 12) {
      return {
        period: 2,
        taskRangeStart: 6,  // 6AM
        taskRangeEnd: 18,   // 6PM
        sunLeft: true,
        sunRight: true
      };
    } else if (currentHour >= 12 && currentHour < 18) {
      return {
        period: 3,
        taskRangeStart: 12, // 12PM
        taskRangeEnd: 24,   // 12AM (next day)
        moonLeft: true,
        sunRight: true
      };
    } else {
      return {
        period: 4,
        taskRangeStart: 18, // 6PM
        taskRangeEnd: 30,   // 6AM (next day, represented as 30 for calculation)
        moonLeft: true,
        moonRight: true
      };
    }
  };
  
  const currentPeriod = getCurrentPeriod();

  // Get today's scheduled tasks
  const todayTasks = useMemo(() => {
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return todoTasks.filter(task => {
      if (!task.isScheduled) return false;
      const taskDate = new Date(task.scheduledDateTime);
      return taskDate >= today && taskDate < tomorrow;
    });
  }, [todoTasks, currentTime]);

  // Calculate hour hand position
  const hourAngle = ((currentHour % 12) + currentMinute / 60) * 30 - 90; // -90 to start from 12 o'clock
  
  // Calculate minute hand position
  const minuteAngle = currentMinute * 6 - 90; // 6 degrees per minute, -90 to start from 12 o'clock
  
  // Calculate second hand position
  const secondAngle = currentSecond * 6 - 90; // 6 degrees per second, -90 to start from 12 o'clock

  // Generate task sectors - show tasks for the current 12-hour period
  const taskSectors = todayTasks
    .filter(task => {
      const taskTime = new Date(task.scheduledDateTime);
      const taskHour = taskTime.getHours();
      
      // Filter tasks based on current period's 12-hour range
      if (currentPeriod.period === 1) {
        // 12AM-6AM period shows 12AM-12PM tasks
        return taskHour >= 0 && taskHour < 12;
      } else if (currentPeriod.period === 2) {
        // 6AM-12PM period shows 6AM-6PM tasks  
        return taskHour >= 6 && taskHour < 18;
      } else if (currentPeriod.period === 3) {
        // 12PM-6PM period shows 12PM-12AM tasks
        return taskHour >= 12 && taskHour < 24;
      } else {
        // 6PM-12AM period shows 6PM-6AM tasks (crosses midnight)
        return taskHour >= 18 || taskHour < 6;
      }
    })
    .map(task => {
      const taskTime = new Date(task.scheduledDateTime);
      const taskHour = taskTime.getHours();
      const taskMinute = taskTime.getMinutes();
      
      // Map actual hour to clock display hour - use standard 12-hour format
      let displayHour = taskHour % 12;
      if (displayHour === 0) displayHour = 12;
      
      const startAngle = ((displayHour % 12) + taskMinute / 60) * 30 - 90;
      
      // Calculate end angle based on actual task duration
      const durationMinutes = task.duration || 30;
      const durationDegrees = (durationMinutes / 60) * 30;
      const endAngle = startAngle + durationDegrees;
      
      return {
        ...task,
        startAngle,
        endAngle,
        hour: displayHour
      };
    });

  // Create SVG path for a sector
  const createSectorPath = (startAngle, endAngle, innerRadius, outerRadius) => {
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = Math.cos(startAngleRad) * innerRadius;
    const y1 = Math.sin(startAngleRad) * innerRadius;
    const x2 = Math.cos(endAngleRad) * innerRadius;
    const y2 = Math.sin(endAngleRad) * innerRadius;
    const x3 = Math.cos(endAngleRad) * outerRadius;
    const y3 = Math.sin(endAngleRad) * outerRadius;
    const x4 = Math.cos(startAngleRad) * outerRadius;
    const y4 = Math.sin(startAngleRad) * outerRadius;
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  const radius = size / 2 - 20;
  const center = size / 2;
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Function to handle navigation to calendar
  const handleScheduleClick = () => {
    router.push('/calendar');
  };

  // Function to handle task sector click
  const handleTaskSectorClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  return (
    <div className={styles.clockContainer}>
      <svg width={size} height={size} className={styles.clockSvg}>
        {/* Clock face */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        
        {/* AM/PM background sections */}
        <defs>
          <clipPath id="leftHalf">
            <rect x={center - radius} y={center - radius} width={radius} height={radius * 2} />
          </clipPath>
          <clipPath id="rightHalf">
            <rect x={center} y={center - radius} width={radius} height={radius * 2} />
          </clipPath>
        </defs>
        
        {/* Sun side (lighter background) and Moon side (darker background) */}
        <>
          {/* Left half */}
          <circle
            cx={center}
            cy={center}
            r={radius - 2}
            fill={currentPeriod.sunLeft ? "var(--brand-50)" : "var(--brand-200)"}
            clipPath="url(#leftHalf)"
          />
          {/* Right half */}
          <circle
            cx={center}
            cy={center}
            r={radius - 2}
            fill={currentPeriod.sunRight ? "var(--brand-50)" : "var(--brand-200)"}
            clipPath="url(#rightHalf)"
          />
        </>
        
        {/* Dividing line (12 to 6) */}
        <line
          x1={center}
          y1={center - radius + 2}
          x2={center}
          y2={center + radius - 2}
          stroke="#d0d0d0"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
        
        {/* Hour marker lines */}
        {hourNumbers.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          const outerX = center + Math.cos(angle) * (radius - 2);
          const outerY = center + Math.sin(angle) * (radius - 2);
          const innerX = center + Math.cos(angle) * (radius - 8.5);
          const innerY = center + Math.sin(angle) * (radius - 8.5);
          
          return (
            <line
              key={`line-${hour}`}
              x1={outerX}
              y1={outerY}
              x2={innerX}
              y2={innerY}
              stroke="#999"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Hour numbers */}
        {hourNumbers.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          const x = center + Math.cos(angle) * (radius - 16);
          const y = center + Math.sin(angle) * (radius - 16);
          
          return (
            <text
              key={hour}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={styles.hourNumber}
              fontSize="14"
              fill="#666"
            >
              {hour}
            </text>
          );
        })}
        
        {/* Task sectors */}
        <g transform={`translate(${center}, ${center})`}>
          {taskSectors.map((task, index) => {
            const taskTime = new Date(task.scheduledDateTime);
            const timeString = taskTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const tooltipText = `${task.taskDescription || task.description || task.title} at ${timeString}${onTaskClick ? ' - Click to update' : ''}`;
            
            return (
              <path
                key={task.timeBlockId || task.id}
                d={createSectorPath(task.startAngle, task.endAngle, radius - 40, radius - 10)}
                fill={task.color}
                fillOpacity="0.6"
                stroke={task.color}
                strokeWidth="1"
                style={{ 
                  cursor: onTaskClick ? 'pointer' : 'default',
                  transition: 'fill-opacity 0.2s ease'
                }}
                onClick={() => handleTaskSectorClick(task)}
                onMouseEnter={(e) => {
                  if (onTaskClick) {
                    e.target.style.fillOpacity = '0.8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onTaskClick) {
                    e.target.style.fillOpacity = '0.6';
                  }
                }}
              >
                <title>{tooltipText}</title>
              </path>
            );
          })}
        </g>
        
        {/* AM/PM indicators with SVG icons */}
        <>
          {/* Left half icon */}
          <image
            x={center - 0.75 * radius + 26.25 - 20}
            y={center - 20}
            width="40"
            height="40"
            href={currentPeriod.sunLeft ? '/sun_icon.svg' : '/moon_icon.svg'}
          />
          {/* Right half icon */}
          <image
            x={center + 0.75 * radius - 26.25 - 20}
            y={center - 20}
            width="40"
            height="40"
            href={currentPeriod.sunRight ? '/sun_icon.svg' : '/moon_icon.svg'}
          />
        </>
        
        {/* Hour hand */}
        <g transform={`translate(${center}, ${center})`}>
          <line
            x1="0"
            y1="0"
            x2={Math.cos((hourAngle * Math.PI) / 180) * (radius - 50)}
            y2={Math.sin((hourAngle * Math.PI) / 180) * (radius - 50)}
            stroke="#333"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        
        {/* Minute hand */}
        <g transform={`translate(${center}, ${center})`}>
          <line
            x1="0"
            y1="0"
            x2={Math.cos((minuteAngle * Math.PI) / 180) * (radius - 30)}
            y2={Math.sin((minuteAngle * Math.PI) / 180) * (radius - 30)}
            stroke="#666"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        
        {/* Second hand */}
        <g transform={`translate(${center}, ${center})`}>
          <line
            x1="0"
            y1="0"
            x2={Math.cos((secondAngle * Math.PI) / 180) * (radius - 20)}
            y2={Math.sin((secondAngle * Math.PI) / 180) * (radius - 20)}
            stroke="#dc2626"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
        
        {/* Center dot */}
        <g transform={`translate(${center}, ${center})`}>
          <circle cx="0" cy="0" r="6" fill="#333" />
        </g>
      </svg>
      
      {/* Schedule List */}
      {taskSectors.length > 0 && (
        <div className={styles.scheduleSection}>
          <div className={styles.scheduleList}>
            {taskSectors
              .sort((a, b) => new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime))
              .map((task, index) => {
                const taskTime = new Date(task.scheduledDateTime);
                const timeString = taskTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                });
                
                // Create subtitle text
                const subtitleParts = [];
                if (task.keyResult) {
                  subtitleParts.push(task.keyResult);
                } else if (task.objective) {
                  subtitleParts.push(task.objective);
                }
                const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : '';
                
                // Convert hex color to rgba with 0.4 opacity
                const hexToRgba = (hex, alpha) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                
                return (
                  <div
                    key={task.timeBlockId || task.id}
                    className={styles.scheduleItem}
                    onClick={() => handleTaskSectorClick(task)}
                    style={{ backgroundColor: task.color ? hexToRgba(task.color, 0.4) : undefined }}
                  >
                    <div className={styles.scheduleTask}>
                      <div style={{ flex: 1 }}>
                        <div className={styles.taskDescription}>
                          {task.taskDescription || task.description || task.title}
                        </div>
                        <div className={styles.taskSubtitle}>
                          {subtitle}
                        </div>
                      </div>
                    </div>
                    <div className={styles.scheduleTime}>{timeString}</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
      
      {/* No tasks message and schedule button - show when current 12-hour period has no tasks */}
      {taskSectors.length === 0 && (
        <div className={styles.noTasksContainer}>
          <p className={styles.noTasksMessage}>No scheduled tasks for this period</p>
          <button
            className={styles.scheduleButton}
            onClick={handleScheduleClick}
          >
            Schedule
          </button>
        </div>
      )}
    </div>
  );
}
            
