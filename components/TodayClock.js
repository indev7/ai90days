'use client';

import { useMemo, useState, useEffect } from 'react';
import styles from './TodayClock.module.css';

export default function TodayClock({ todoTasks, size = 200 }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
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

  return (
    <div className={styles.clockContainer} style={{ width: size, height: size }}>
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
          {taskSectors.map((task, index) => (
            <path
              key={task.id}
              d={createSectorPath(task.startAngle, task.endAngle, radius - 40, radius - 10)}
              fill={task.color}
              fillOpacity="0.6"
              stroke={task.color}
              strokeWidth="1"
            />
          ))}
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
    </div>
  );
}
            
