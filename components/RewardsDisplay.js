'use client';

import React, { useState, useEffect, useImperativeHandle } from 'react';
import styles from './RewardsDisplay.module.css';

const RewardsDisplay = React.forwardRef(({ okrtId }, ref) => {
  const [rewards, setRewards] = useState({ medal: 0, star: 0, cookie: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewards();
  }, [okrtId]);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comments/rewards?okrtId=${okrtId}`);
      const data = await response.json();
      
      if (response.ok) {
        const rewardSummary = { medal: 0, star: 0, cookie: 0 };
        data.rewards.forEach(reward => {
          rewardSummary[reward.type] = reward.total_count;
        });
        setRewards(rewardSummary);
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refresh: fetchRewards
  }));

  const getRewardEmojis = () => {
    const { medal, star, cookie } = rewards;
    const totalCount = medal + star + cookie;
    
    if (totalCount === 0) return null;
    
    const rewardIcons = {
      medal: '🏅',
      star: '⭐',
      cookie: '🍪'
    };

    // If total is less than 7, display individual emojis
    if (totalCount < 7) {
      const emojis = [];
      
      // Add individual medal emojis
      for (let i = 0; i < medal; i++) {
        emojis.push(<span key={`medal-${i}`} className={styles.rewardEmoji}>{rewardIcons.medal}</span>);
      }
      
      // Add individual star emojis
      for (let i = 0; i < star; i++) {
        emojis.push(<span key={`star-${i}`} className={styles.rewardEmoji}>{rewardIcons.star}</span>);
      }
      
      // Add individual cookie emojis
      for (let i = 0; i < cookie; i++) {
        emojis.push(<span key={`cookie-${i}`} className={styles.rewardEmoji}>{rewardIcons.cookie}</span>);
      }
      
      return emojis;
    } else {
      // Summarize with emoji and count
      const summary = [];
      
      if (medal > 0) {
        summary.push(
          <span key="medal-summary" className={styles.rewardSummary}>
            {rewardIcons.medal} {medal}
          </span>
        );
      }
      
      if (star > 0) {
        summary.push(
          <span key="star-summary" className={styles.rewardSummary}>
            {rewardIcons.star} {star}
          </span>
        );
      }
      
      if (cookie > 0) {
        summary.push(
          <span key="cookie-summary" className={styles.rewardSummary}>
            {rewardIcons.cookie} {cookie}
          </span>
        );
      }
      
      return summary;
    }
  };

  if (loading) return null;

  const rewardElements = getRewardEmojis();
  if (!rewardElements || rewardElements.length === 0) return null;

  return (
    <div className={styles.rewardsDisplay}>
      {rewardElements}
    </div>
  );
});

export default RewardsDisplay;