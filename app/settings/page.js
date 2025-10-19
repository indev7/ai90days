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
  const [preferredVoice, setPreferredVoice] = useState('alloy');
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const router = useRouter();

  const voices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and friendly' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and soothing' },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          
          // Parse preferences to get preferred voice
          if (data.user.preferences) {
            try {
              const preferences = JSON.parse(data.user.preferences);
              setPreferredVoice(preferences.preferred_voice || 'alloy');
            } catch (e) {
              console.error('Failed to parse preferences:', e);
            }
          }
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

  const handleVoiceChange = async (newVoice) => {
    setIsSavingVoice(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: user.firstName || user.displayName.split(' ')[0] || '',
          lastName: user.lastName || user.displayName.split(' ').slice(1).join(' ') || '',
          preferredVoice: newVoice,
        }),
      });

      if (response.ok) {
        setPreferredVoice(newVoice);
      } else {
        console.error('Failed to save voice preference');
      }
    } catch (error) {
      console.error('Error saving voice preference:', error);
    } finally {
      setIsSavingVoice(false);
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
            <h2 className={styles.sectionTitle}>Coach Voice</h2>
            
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Text-to-Speech Voice</label>
                <p className={styles.settingDescription}>
                  Choose the voice for your AI coach
                </p>
              </div>
              
              <div className={styles.themeToggle}>
                {voices.map((voice) => (
                  <button
                    key={voice.id}
                    className={`${styles.themeOption} ${preferredVoice === voice.id ? styles.active : ''}`}
                    onClick={() => handleVoiceChange(voice.id)}
                    disabled={isSavingVoice}
                    title={voice.description}
                  >
                    <span>{voice.name}</span>
                  </button>
                ))}
              </div>
              
              {isSavingVoice && (
                <div className={styles.loadingIndicator}>
                  Saving...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
