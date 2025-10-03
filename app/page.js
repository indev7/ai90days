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
          // Redirect authenticated users directly to dashboard
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

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

  // User is authenticated - this should not be reached since we redirect above
  // But just in case, we'll still redirect here as a fallback
  return null;
}
