'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.landingContainer}>
        <div className={styles.landingContent}>
          <div className={styles.logoSection}>
            <div className={styles.landingLogo}>
              <span className={styles.landingLogoNumber}>90</span>
              <span className={styles.landingLogoWord}>Days</span>
            </div>
          </div>
          <h1 className={styles.landingTitle}>Transform your goals into achievements</h1>
          <p className={styles.landingSubtitle}>
            Join thousands who have successfully completed their 90-day goal cycles
          </p>
          <div className={styles.landingActions}>
            <Link href="/signup" className="btn btn-primary">
              Get Started
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome back, {user.displayName}!</h1>
          <p className={styles.subtitle}>Ready to tackle your goals?</p>
        </div>
        
        <div className={styles.placeholder}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Dashboard Coming Soon</h2>
            <p className={styles.cardText}>
              Your personal goal tracking dashboard will be available in Phase 2. 
              For now, you can access your profile through the navigation menu.
            </p>
            <Link href="/dashboard" className="btn btn-primary">
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
