'use client';

import TodayClock from './TodayClock';
import styles from './TodayWidget.module.css';

export default function TodayWidget({ objectives, todoTasks }) {
  const currentDate = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const todayLabel = `${dayNames[currentDate.getDay()]}, ${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}`;

  return (
    <div className={styles.componentCard}>
      <div className={styles.componentHeader}>
        <h3 className={styles.componentTitle}>Today</h3>
        <div className={styles.dateLabel}>{todayLabel}</div>
      </div>
      <div className={styles.componentContent}>
        <TodayClock todoTasks={todoTasks} size={220} />
      </div>
    </div>
  );
}

