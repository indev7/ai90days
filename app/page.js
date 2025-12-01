'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';

import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    // Redirect authenticated users directly to their preferred home
    if (user) {
      router.push('/home');
    }
  }, [user, router]);

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
