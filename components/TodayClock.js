'use client';

import { useMemo } from 'react';
import styles from './TodayClock.module.css';

export default function TodayClock({ todoTasks, size = 200 }) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isAM = currentHour < 12;
  
  // Get today's scheduled tasks
  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return todoTasks.filter(task => {
      if (!task.isScheduled) return false;
      const taskDate = new Date(task.scheduledDateTime);
      return taskDate >= today && taskDate < tomorrow;
    });
  }, [todoTasks]);

  // Calculate hour hand position
  const hourAngle = ((currentHour % 12) + currentMinute / 60) * 30 - 90; // -90 to start from 12 o'clock

  // Generate task sectors
  const taskSectors = todayTasks.map(task => {
    const taskTime = new Date(task.scheduledDateTime);
    const taskHour = taskTime.getHours();
    const taskMinute = taskTime.getMinutes();
    
    // Convert to angle (12 o'clock = 0°, 3 o'clock = 90°, etc.)
    const startAngle = ((taskHour % 12) + taskMinute / 60) * 30 - 90;
    const endAngle = startAngle + 15; // 30-minute sector (15 degrees)
    
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
          fill="#f7fbff"
          stroke="#e5e5e5"
          strokeWidth="2"
        />
        
        {/* Hour markers */}
        {hourNumbers.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          const x = center + Math.cos(angle) * (radius - 25);
          const y = center + Math.sin(angle) * (radius - 25);
          
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
          {/* Center dot */}
          <circle cx="0" cy="0" r="6" fill="#333" />
        </g>
        
        {/* AM/PM indicators with emojis */}
        {isAM ? (
          <>
            {/* Left half: 6am to 12pm (Sun) */}
            <text
              x={center - radius + 35}
              y={center + 5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
            >
              ☀️
            </text>
            {/* Right half: 12am to 6am (Moon) */}
            <text
              x={center + radius - 35}
              y={center + 5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
            >
              🌙
            </text>
          </>
        ) : (
          <>
            {/* Left half: 6pm to 12am (Moon) */}
            <text
              x={center - radius + 35}
              y={center + 5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
            >
              🌙
            </text>
            {/* Right half: 12pm to 6pm (Sun) */}
            <text
              x={center + radius - 35}
              y={center + 5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
            >
              ☀️
            </text>
          </>
        )}
      </svg>
      
      {/* Task legend */}
      {todayTasks.length > 0 && (
        <div className={styles.taskLegend}>
          {todayTasks.map(task => (
            <div key={task.id} className={styles.legendItem}>
              <div 
                className={styles.legendColor} 
                style={{ backgroundColor: task.color }}
              />
              <span className={styles.legendText}>
                {new Date(task.scheduledDateTime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
