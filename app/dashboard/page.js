'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useObjective } from '@/contexts/ObjectiveContext';
import styles from './page.module.css';

// Helper function to get status badge
const getStatusBadge = (status) => {
  const badges = {
    'D': { label: 'Draft', className: styles.statusDraft },
    'A': { label: 'Active', className: styles.statusActive },
    'C': { label: 'Complete', className: styles.statusComplete }
  };
  return badges[status] || { label: 'Unknown', className: '' };
};

export default function DashboardPage() {
  const router = useRouter();
  const { setSelectedObjectiveId } = useObjective();
  const [okrts, setOkrts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          fetchOkrts();
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchOkrts = async () => {
    try {
      const response = await fetch('/api/okrt');
      const data = await response.json();
      
      if (response.ok) {
        const list = data.okrts || [];
        setOkrts(list);
      } else {
        setError(data.error || 'Failed to fetch OKRTs');
      }
    } catch (err) {
      setError('Network error while fetching OKRTs');
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (items) => {
    const itemMap = {};
    const rootItems = [];

    // First pass: create map
    items.forEach(item => {
      itemMap[item.id] = { ...item, children: [] };
    });

    // Second pass: build hierarchy
    items.forEach(item => {
      if (item.parent_id && itemMap[item.parent_id]) {
        itemMap[item.parent_id].children.push(itemMap[item.id]);
      } else {
        rootItems.push(itemMap[item.id]);
      }
    });

    return rootItems;
  };

  const handleCardClick = (objectiveId) => {
    // Set the selected objective ID in the context
    setSelectedObjectiveId(objectiveId);
    // Navigate to My Goals page
    router.push('/okrt');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.error}>Error: {error}</div>
        </div>
      </div>
    );
  }

  const hierarchicalOkrts = buildHierarchy(okrts);
  const rootObjectives = hierarchicalOkrts.filter(item => item.type === 'O');

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Track your goals and progress</p>
        </div>

        {rootObjectives.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎯</div>
            <h2>No goals yet</h2>
            <p>Create your first Objective to get started.</p>
            <button 
              className={styles.createButton}
              onClick={() => router.push('/new')}
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          <>
            <div className={styles.cardsHeaderRow}>
              <h2 className={styles.sectionTitle}>Your Goals</h2>
            </div>
            <div className={styles.cardsGrid}>
              {rootObjectives.map(obj => {
                const statusBadge = getStatusBadge(obj.status);
                return (
                  <div 
                    key={obj.id} 
                    className={styles.objectiveCard}
                    onClick={() => handleCardClick(obj.id)}
                  >
                    {obj.header_image_url ? (
                      <div className={styles.objectiveImage} style={{backgroundImage:`url(${obj.header_image_url})`}} />
                    ) : (
                      <div className={styles.objectiveImage} />
                    )}
                    <div className={styles.objectiveCardContent}>
                      <div className={styles.objectiveTitle}>{obj.title}</div>
                      
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
