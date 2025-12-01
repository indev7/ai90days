'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { themes, loadTheme, getCurrentTheme } from '@/lib/themeManager';
import styles from './page.module.css';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState('coffee');
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [preferredVoice, setPreferredVoice] = useState('alloy');
  const [preferredHome, setPreferredHome] = useState('dashboard');
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({
    voice: 'alloy',
    home: 'dashboard',
    theme: 'coffee',
  });
  const router = useRouter();

  const normalizePreferredHome = (value) => {
    if (typeof value !== 'string') return 'dashboard';
    const normalized = value.trim().toLowerCase();
    if (['dashboard', 'shared', 'business'].includes(normalized)) return normalized;
    if (normalized === 'buisness') return 'business';
    return 'dashboard';
  };

  const normalizeTheme = (value) => {
    if (typeof value !== 'string') return 'coffee';
    const normalized = value.trim().toLowerCase();
    const validIds = themes.map(t => t.id);
    if (validIds.includes(normalized)) return normalized;
    if (normalized === 'blue') return 'microsoft';
    return 'coffee';
  };

  const computeHasChanges = (voiceValue, homeValue, themeValue) => {
    return (
      voiceValue !== initialPreferences.voice ||
      homeValue !== initialPreferences.home ||
      themeValue !== initialPreferences.theme
    );
  };

  const voices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and friendly' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and soothing' },
  ];

  const parsePreferences = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse preferences:', e);
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);

          // Parse preferences to get preferred voice, home, and theme
          let nextVoice = 'alloy';
          let nextHome = 'dashboard';
          let nextTheme = normalizeTheme(getCurrentTheme());

          const parsedPreferences = parsePreferences(data.user.preferences);
          if (parsedPreferences) {
            nextVoice = parsedPreferences.preferred_voice || 'alloy';
            nextHome = normalizePreferredHome(parsedPreferences.preferred_home);
            nextTheme = normalizeTheme(parsedPreferences.theme || nextTheme);
          }

          setPreferredVoice(nextVoice);
          setPreferredHome(nextHome);
          setTheme(nextTheme);
          setInitialPreferences({ voice: nextVoice, home: nextHome, theme: nextTheme });
          setHasChanges(false);
          await loadTheme(nextTheme);
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

  }, [router]);

  const handleThemeChange = async (newTheme) => {
    setIsLoadingTheme(true);
    try {
      const success = await loadTheme(newTheme);
      if (success) {
        const normalizedTheme = normalizeTheme(newTheme);
        setTheme(normalizedTheme);
        setHasChanges(computeHasChanges(preferredVoice, preferredHome, normalizedTheme));
      } else {
        console.error('Failed to load theme:', newTheme);
      }
    } catch (error) {
      console.error('Error changing theme:', error);
    } finally {
      setIsLoadingTheme(false);
    }
  };

  const handleVoiceChange = (newVoice) => {
    setPreferredVoice(newVoice);
    setHasChanges(computeHasChanges(newVoice, preferredHome, theme));
  };

  const handleHomeChange = (newHome) => {
    setPreferredHome(newHome);
    setHasChanges(computeHasChanges(preferredVoice, newHome, theme));
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
                    title={voice.description}
                  >
                    <span>{voice.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Home Page</h2>
            
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Preferred landing page</label>
                <p className={styles.settingDescription}>
                  Choose where to go right after you log in
                </p>
              </div>
              
              <div className={styles.themeToggle}>
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'shared', label: 'Shared OKRs' },
                  { id: 'business', label: 'Business' },
                ].map((option) => (
                  <button
                    key={option.id}
                    className={`${styles.themeOption} ${preferredHome === option.id ? styles.active : ''}`}
                    onClick={() => handleHomeChange(option.id)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.saveBar}>
            <button
              type="button"
              className={styles.saveButton}
              disabled={!hasChanges || isSavingPreferences}
              onClick={async () => {
                setIsSavingPreferences(true);
                try {
                  const response = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  body: JSON.stringify({
                    firstName: user.firstName || user.displayName.split(' ')[0] || '',
                    lastName: user.lastName || user.displayName.split(' ').slice(1).join(' ') || '',
                    preferredVoice,
                    preferredHome,
                    preferredTheme: theme,
                  }),
                });

                if (response.ok) {
                  setInitialPreferences({
                    voice: preferredVoice,
                    home: preferredHome,
                    theme,
                  });
                  setHasChanges(false);
                  } else {
                    console.error('Failed to save preferences');
                  }
                } catch (error) {
                  console.error('Error saving preferences:', error);
                } finally {
                  setIsSavingPreferences(false);
                }
              }}
            >
              {isSavingPreferences ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
