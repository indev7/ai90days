'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TwelveWeekClock from '@/components/TwelveWeekClock';
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
        if (okrtsResponse.ok) {
          const okrtsData = await okrtsResponse.json();
          const okrts = okrtsData.okrts || [];
          
          // Transform OKRTs to objectives format
          const colorPalette = getThemeColorPalette();
          const transformedObjectives = transformOKRTsToObjectives(okrts, colorPalette);
          setObjectives(transformedObjectives);
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
        <div className={styles.clockWidget}>
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

        {objectives.length === 0 && (
          <div className={styles.emptyState}>
            <h3>No Objectives Found</h3>
            <p>Create your first objective to see your 12-week progress clock.</p>
            <a href="/okrt" className={styles.createButton}>
              Create Objective
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
