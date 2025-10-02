'use client';

import TodayClock from './TodayClock';
import styles from './TodayWidget.module.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function TodayWidget({ objectives, todoTasks }) {
  const currentDate = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const todayLabel = `${dayNames[currentDate.getDay()]}, ${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}`;

  // Responsive clock sizing to fill available area
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const getTodayClockSize = () => {
    if (isMobile) return 220; // Smaller for mobile
    if (isTablet) return 200; // Medium for tablet
    return 260; // Larger for desktop to fill the available space better
  };

  return (
    <div className={styles.componentCard}>
      <div className={styles.componentHeader}>
        <h3 className={styles.componentTitle}>{todayLabel}</h3>
      </div>
      <div className={styles.componentContent}>
        <TodayClock todoTasks={todoTasks} size={getTodayClockSize()} />
      </div>
    </div>
  );
}

