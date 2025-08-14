import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import styles from './page.module.css';

export default async function ProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Track your goals and progress</p>
        </div>

        <div className={styles.card}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Account Information</h2>
            <div className={styles.info}>
              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <div className={styles.value}>{session.displayName}</div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Username</label>
                <div className={styles.value}>{session.username}</div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Coming Soon</h2>
            <p className={styles.sectionText}>
              Profile editing, password changes, and account preferences will be available in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
