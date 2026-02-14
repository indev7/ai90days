'use client';

import { useState, useEffect } from 'react';
import { themes, loadTheme, getCurrentTheme, normalizeThemeId } from '@/lib/themeManager';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import useAimeStore from '@/store/aimeStore';
import { useUser } from '@/hooks/useUser';
import { RiSettings3Line } from 'react-icons/ri';
import styles from './page.module.css';

const DEFAULT_AIME_PERSONALITY_ID = 1;

export default function SettingsPage() {
  const { user, isLoading: userLoading } = useUser();
  const { isLoading: mainTreeLoading } = useMainTree();
  const { mainTree, setPreferences } = useMainTreeStore();
  const [theme, setTheme] = useState('coffee');
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [preferredVoice, setPreferredVoice] = useState('alloy');
  const [preferredHome, setPreferredHome] = useState('dashboard');
  const [aimePersonality, setAimePersonality] = useState(DEFAULT_AIME_PERSONALITY_ID);
  const [personalityOptions, setPersonalityOptions] = useState([]);
  const [defaultPersonalityId, setDefaultPersonalityId] = useState(DEFAULT_AIME_PERSONALITY_ID);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({
    voice: 'alloy',
    home: 'dashboard',
    theme: 'coffee',
    personality: DEFAULT_AIME_PERSONALITY_ID
  });
  const setSelectedPersonalityId = useAimeStore((state) => state.setSelectedPersonalityId);
  const normalizePreferredHome = (value) => {
    if (typeof value !== 'string') return 'dashboard';
    const normalized = value.trim().toLowerCase();
    if (['dashboard', 'shared', 'business'].includes(normalized)) return normalized;
    if (normalized === 'buisness') return 'business';
    return 'dashboard';
  };

  const computeHasChanges = (voiceValue, homeValue, themeValue, personalityValue) => {
    return (
      voiceValue !== initialPreferences.voice ||
      homeValue !== initialPreferences.home ||
      themeValue !== initialPreferences.theme ||
      personalityValue !== initialPreferences.personality
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

  // Apply preferences from mainTree (or fallback to user.preferences) when available
  useEffect(() => {
    if (hasChanges) return; // Do not override in-flight edits

    const sourcePrefs =
      (mainTree && mainTree.preferences) ||
      (user && user.preferences ? (() => {
        try { return JSON.parse(user.preferences); } catch { return null; }
      })() : null);

    if (!sourcePrefs) return;

    const nextVoice = sourcePrefs.preferred_voice || 'alloy';
    const nextHome = normalizePreferredHome(sourcePrefs.preferred_home);
    const nextTheme = normalizeThemeId(sourcePrefs.theme || getCurrentTheme());

    setPreferredVoice(nextVoice);
    setPreferredHome(nextHome);
    setTheme(nextTheme);
    setInitialPreferences({ voice: nextVoice, home: nextHome, theme: nextTheme });
    setHasChanges(false);
    loadTheme(nextTheme);
  }, [mainTree, user, hasChanges]);

  useEffect(() => {
    let isMounted = true;
    const loadPersonalityOptions = async () => {
      try {
        const response = await fetch('/api/aime');
        if (!response.ok) throw new Error('Failed to load personality options');
        const data = await response.json();
        if (!isMounted) return;
        const options = Array.isArray(data?.personalities) ? data.personalities : [];
        const defaultId = Number.isFinite(Number(data?.defaultPersonalityId))
          ? Number(data.defaultPersonalityId)
          : DEFAULT_AIME_PERSONALITY_ID;
        setPersonalityOptions(options);
        setDefaultPersonalityId(defaultId);
      } catch (error) {
        console.error('Failed to load AIME personalities:', error);
      }
    };
    loadPersonalityOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleThemeChange = async (newTheme) => {
    setIsLoadingTheme(true);
    try {
      const success = await loadTheme(newTheme);
      if (success) {
        const normalizedTheme = normalizeThemeId(newTheme);
        setTheme(normalizedTheme);
        setHasChanges(computeHasChanges(preferredVoice, preferredHome, normalizedTheme, aimePersonality));
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
    setHasChanges(computeHasChanges(newVoice, preferredHome, theme, aimePersonality));
  };

  const handleHomeChange = (newHome) => {
    setPreferredHome(newHome);
    setHasChanges(computeHasChanges(preferredVoice, newHome, theme, aimePersonality));
  };

  useEffect(() => {
    const savedPersonalityId = window.localStorage.getItem('aime-personality-id');
    const parsedPersonalityId = Number(savedPersonalityId);
    const hasOption = (id) =>
      personalityOptions.length === 0 || personalityOptions.some((option) => option.id === id);
    const resolvedPersonalityId =
      Number.isFinite(parsedPersonalityId) && hasOption(parsedPersonalityId)
        ? parsedPersonalityId
        : defaultPersonalityId;

    setAimePersonality(resolvedPersonalityId);
    setSelectedPersonalityId(resolvedPersonalityId);
    setInitialPreferences((prev) => ({
      ...prev,
      personality: resolvedPersonalityId
    }));
  }, [defaultPersonalityId, personalityOptions, setSelectedPersonalityId]);

  const handleAimePersonalityChange = (nextId) => {
    const parsedPersonalityId = Number(nextId);
    if (!Number.isFinite(parsedPersonalityId)) return;
    setAimePersonality(parsedPersonalityId);
    setSelectedPersonalityId(parsedPersonalityId);
    window.localStorage.setItem('aime-personality-id', String(parsedPersonalityId));
    setHasChanges(computeHasChanges(preferredVoice, preferredHome, theme, parsedPersonalityId));
  };

  if (userLoading || mainTreeLoading) {
    return (
      <div className={`app-page ${styles.container}`}>
        <div className="app-pageContent">
          <div className="app-pageHeader">
            <div className="app-titleSection">
              <RiSettings3Line className="app-pageIcon" />
              <h1 className="app-pageTitle">Settings</h1>
            </div>
          </div>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`app-page ${styles.container}`}>
      <div className="app-pageContent">
        <div className="app-pageHeader">
          <div className="app-titleSection">
            <RiSettings3Line className="app-pageIcon" />
            <h1 className="app-pageTitle">Settings</h1>
          </div>
        </div>
        <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            
            <div className={styles.setting}>
              <label className={styles.settingLabel}>Theme</label>
              
              <div className={styles.radioGroup}>
                {themes.map((themeOption) => (
                  <label
                    key={themeOption.id}
                    className={`${styles.radioOption} ${theme === themeOption.id ? styles.active : ''}`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={themeOption.id}
                      checked={theme === themeOption.id}
                      onChange={() => handleThemeChange(themeOption.id)}
                      disabled={isLoadingTheme}
                    />
                    <span className={styles.radioLabel}>{themeOption.name}</span>
                  </label>
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
              <label className={styles.settingLabel}>Text-to-Speech Voice</label>
              
              <div className={styles.radioGroup}>
                {voices.map((voice) => (
                  <label
                    key={voice.id}
                    className={`${styles.radioOption} ${preferredVoice === voice.id ? styles.active : ''}`}
                    title={voice.description}
                  >
                    <input
                      type="radio"
                      name="voice"
                      value={voice.id}
                      checked={preferredVoice === voice.id}
                      onChange={() => handleVoiceChange(voice.id)}
                    />
                    <span className={styles.radioLabel}>{voice.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Home Page</h2>
            
            <div className={styles.setting}>
              <label className={styles.settingLabel}>Preferred landing page</label>
              
              <div className={styles.radioGroup}>
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'shared', label: 'Shared OKRs' },
                  { id: 'business', label: 'Business' },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={`${styles.radioOption} ${preferredHome === option.id ? styles.active : ''}`}
                  >
                    <input
                      type="radio"
                      name="home"
                      value={option.id}
                      checked={preferredHome === option.id}
                      onChange={() => handleHomeChange(option.id)}
                    />
                    <span className={styles.radioLabel}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>AIME Style</h2>

            <div className={styles.setting}>
              <label className={styles.settingLabel}>Assistant personality style</label>

              <div className={styles.radioGroup}>
                {personalityOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`${styles.radioOption} ${aimePersonality === option.id ? styles.active : ''}`}
                  >
                    <input
                      type="radio"
                      name="aimePersonality"
                      value={option.id}
                      checked={aimePersonality === option.id}
                      onChange={() => handleAimePersonalityChange(option.id)}
                    />
                    <span className={styles.radioLabel}>{option.label}</span>
                  </label>
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
                      personality: aimePersonality
                    });
                    setHasChanges(false);
                    setPreferences({
                      ...(mainTree?.preferences || {}),
                      preferred_voice: preferredVoice,
                      preferred_home: preferredHome,
                      theme,
                    });
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
              {isSavingPreferences ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
