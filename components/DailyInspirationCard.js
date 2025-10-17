'use client';

import { useState, useEffect } from 'react';
import styles from './DailyInspirationCard.module.css';
import { fetchDailyInspirations, getRandomInspiration, getImageUrl } from '@/lib/graphql';

export default function DailyInspirationCard() {
  const [inspiration, setInspiration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    async function loadInspiration() {
      try {
        setLoading(true);
        const inspirations = await fetchDailyInspirations();
        
        if (inspirations.length === 0) {
          setError('No inspirations available');
          return;
        }

        const randomInspiration = getRandomInspiration(inspirations);
        setInspiration(randomInspiration);
      } catch (err) {
        console.error('Error loading inspiration:', err);
        setError('Failed to load inspiration');
      } finally {
        setLoading(false);
      }
    }

    loadInspiration();
  }, []);

  const handleReadMore = () => {
    setShowFullContent(true);
  };

  const handleClose = () => {
    setShowFullContent(false);
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>Loading inspiration...</div>
      </div>
    );
  }

  if (error || !inspiration) {
    return (
      <div className={styles.card}>
        <div className={styles.error}>
          {error || 'No inspiration available'}
        </div>
      </div>
    );
  }

  const backgroundImageUrl = getImageUrl(inspiration.dailyInspirations?.backgroundImage);
  const shortContent = inspiration.dailyInspirations?.shortContent || '';
  const longContent = inspiration.dailyInspirations?.longContent || '';
  const title = inspiration.title || 'Daily Inspiration';

  return (
    <>
      <div
        className={styles.card}
        style={{
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none'
        }}
      >
        <div className={styles.overlay}>
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: shortContent }}
          />
          <button
            className={styles.readMoreBtn}
            onClick={handleReadMore}
            aria-label="Read more"
          >
            Read More
          </button>
        </div>
      </div>

      {showFullContent && (
        <div className={styles.modal} onClick={handleClose}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {backgroundImageUrl && (
              <div
                className={styles.modalHero}
                style={{
                  backgroundImage: `url(${backgroundImageUrl})`
                }}
              />
            )}
            <button
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>
            <div
              className={styles.modalBody}
              dangerouslySetInnerHTML={{ __html: longContent || shortContent }}
            />
          </div>
        </div>
      )}
    </>
  );
}