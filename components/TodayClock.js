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
  const isAM = currentHour < 12;
  
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

  // Generate task sectors - only show tasks for the current AM/PM period
  const taskSectors = todayTasks
    .filter(task => {
      const taskTime = new Date(task.scheduledDateTime);
      const taskHour = taskTime.getHours();
      const taskIsAM = taskHour < 12;
      
      // Only show tasks that match the current AM/PM period
      return taskIsAM === isAM;
    })
    .map(task => {
      const taskTime = new Date(task.scheduledDateTime);
      const taskHour = taskTime.getHours();
      const taskMinute = taskTime.getMinutes();
      
      // Convert to angle (12 o'clock = 0°, 3 o'clock = 90°, etc.)
      const startAngle = ((taskHour % 12) + taskMinute / 60) * 30 - 90;
      
      // Calculate end angle based on actual task duration
      const durationMinutes = task.duration || 30; // Default to 30 minutes if no duration
      const durationDegrees = (durationMinutes / 60) * 30; // Convert minutes to degrees (30 degrees per hour)
      const endAngle = startAngle + durationDegrees;
      
      return {
        ...task,
        startAngle,
        endAngle,
        hour: taskHour % 12 || 12
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
        {isAM ? (
          <>
            {/* Sun side - left half */}
            <circle
              cx={center}
              cy={center}
              r={radius - 2}
              fill="var(--brand-50)"
              clipPath="url(#leftHalf)"
            />
            {/* Moon side - right half */}
            <circle
              cx={center}
              cy={center}
              r={radius - 2}
              fill="var(--brand-200)"
              clipPath="url(#rightHalf)"
            />
          </>
        ) : (
          <>
            {/* Moon side - left half */}
            <circle
              cx={center}
              cy={center}
              r={radius - 2}
              fill="var(--brand-200)"
              clipPath="url(#leftHalf)"
            />
            {/* Sun side - right half */}
            <circle
              cx={center}
              cy={center}
              r={radius - 2}
              fill="var(--brand-50)"
              clipPath="url(#rightHalf)"
            />
          </>
        )}
        
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
        
        {/* AM/PM indicators with emojis */}
        {isAM ? (
          <>
            {/* Left half: 6am to 12pm (Sun) */}
            <text
              x={center - 0.75 * radius + 26.25}
              y={center}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="40"
            >
              ☀️
            </text>
            {/* Right half: 12am to 6am (Moon) */}
            <text
              x={center + 0.75 * radius - 26.25}
              y={center}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="40"
            >
              🌙
            </text>
          </>
        ) : (
          <>
            {/* Left half: 6pm to 12am (Moon) */}
            <text
              x={center - 0.75 * radius + 26.25}
              y={center}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="40"
            >
              🌙
            </text>
            {/* Right half: 12pm to 6pm (Sun) */}
            <text
              x={center + 0.75 * radius - 26.25}
              y={center}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="40"
            >
              ☀️
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
