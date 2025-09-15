'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { themes, loadTheme, getCurrentTheme, getThemesByFamily } from '@/lib/themeManager';
import styles from './page.module.css';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState('coffee');
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    // Get current theme
    const currentTheme = getCurrentTheme();
    setTheme(currentTheme);
  }, [router]);

  const handleThemeChange = async (newTheme) => {
    setIsLoadingTheme(true);
    try {
      const success = await loadTheme(newTheme);
      if (success) {
        setTheme(newTheme);
      } else {
        console.error('Failed to load theme:', newTheme);
      }
    } catch (error) {
      console.error('Error changing theme:', error);
    } finally {
      setIsLoadingTheme(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Customize your 90Days experience</p>
        </div>

        <div className={styles.card}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Theme</label>
                <p className={styles.settingDescription}>
                  Choose between Coffee Brown Light and Microsoft Light themes
                </p>
              </div>
              
              <div className={styles.themeToggle}>
                {themes.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    className={`${styles.themeOption} ${theme === themeOption.id ? styles.active : ''}`}
                    onClick={() => handleThemeChange(themeOption.id)}
                    disabled={isLoadingTheme}
                  >
                    <div
                      className={styles.themePreview}
                      style={{
                        backgroundColor: themeOption.preview,
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}
                    />
                    <span>{themeOption.name}</span>
                  </button>
                ))}
              </div>
              
              {isLoadingTheme && (
                <div className={styles.loadingIndicator}>
                  Loading theme...
                </div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Coming Soon</h2>
            <p className={styles.sectionText}>
              Additional settings like notifications, privacy preferences, and account management will be available in future updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
