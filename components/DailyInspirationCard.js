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
              >
                <div className={styles.aiLabel} aria-label="Includes Content by AI">
                  <svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 0 104 30">
                    <rect
                      x="0.6"
                      y="0.6"
                      width="102.8"
                      height="28.8"
                      rx="14.4"
                      ry="14.4"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.2"
                    />
                    <text
                      x="52"
                      y="12.4"
                      textAnchor="middle"
                      fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
                      fontSize="9.2"
                      fontWeight="600"
                      letterSpacing="0.1"
                      fill="#FFF"
                    >
                      <tspan x="52" dy="0">
                        AI Generated
                      </tspan>
                      <tspan x="52" dy="9.0">
                        Content Included
                      </tspan>
                    </text>
                  </svg>
                </div>
              </div>
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
