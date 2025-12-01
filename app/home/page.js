'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

const homeRoutes = {
  dashboard: '/dashboard',
  shared: '/shared',
  business: '/organisation?view=strategy',
};

const normalizePreferredHome = (value) => {
  if (typeof value !== 'string') return 'dashboard';
  const normalized = value.trim().toLowerCase();
  if (homeRoutes[normalized]) return normalized;

  // Handle common misspelling
  if (normalized === 'buisness') return 'business';
  return 'dashboard';
};

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

export default function HomeRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    let preferred = 'dashboard';

    const parsedPreferences = parsePreferences(user.preferences);
    if (parsedPreferences) {
      preferred = normalizePreferredHome(parsedPreferences.preferred_home);
    }

    const destination = homeRoutes[preferred] || homeRoutes.dashboard;
    router.replace(destination);
  }, [user, isLoading, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      Loading your home...
    </div>
  );
}
