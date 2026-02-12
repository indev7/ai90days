import React from 'react';
import styles from '@/app/shared/page.module.css';
import {
  getInitials,
  getOwnerAvatar,
  getOwnerName
} from './sharedObjectiveCardUtils';

export default function SharedObjectiveCardSmall({
  title,
  ownerName,
  ownerAvatar,
  progress = 0,
  counts = {},
  familyColor,
  onClick,
  className = ''
}) {
  const resolvedOwnerName = ownerName || getOwnerName({ ownerName });
  const resolvedAvatar = ownerAvatar || getOwnerAvatar({ ownerAvatar });
  const resolvedProgress = Number.isFinite(progress) ? progress : 0;
  const style = familyColor ? { '--family-color': familyColor } : undefined;

  return (
    <button
      type="button"
      className={`${styles.chartNode} ${className}`}
      onClick={onClick}
      style={style}
    >
      <h3 className={styles.chartTitle} title={title}>
        {title || 'Untitled objective'}
      </h3>
      <div className={styles.chartOwner}>
        {resolvedAvatar ? (
          <img
            src={resolvedAvatar}
            alt={resolvedOwnerName}
            className={styles.ownerAvatar}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={styles.ownerInitials}>
            {getInitials(resolvedOwnerName)}
          </div>
        )}
        <span className={styles.ownerName}>{resolvedOwnerName}</span>
      </div>
      <div className={styles.chartProgress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${resolvedProgress}%` }}
          />
        </div>
        <span className={styles.progressText}>{resolvedProgress}%</span>
      </div>
      <div className={styles.chartCounts}>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            Inits:{counts.initiatives ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            KPIs:{counts.kpis ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            KRs:{counts.krs ?? 0}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countInline}>
            Children:{counts.children ?? 0}
          </span>
        </div>
      </div>
    </button>
  );
}
