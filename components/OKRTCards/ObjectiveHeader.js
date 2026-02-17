import { useMemo } from 'react';
import { GrTrophy } from 'react-icons/gr';
import { MdFilterCenterFocus, MdSwapHoriz } from "react-icons/md";
import Chip from './Chip';
import ProgressRing from './ProgressRing';
import RewardsDisplay from '../RewardsDisplay';
import styles from '../../app/okrt/page.module.css';
import useMainTreeStore from '@/store/mainTreeStore';

export default function ObjectiveHeader({
  objective,
  onEditObjective,
  isExpanded,
  onToggleExpanded,
  onShareObjective,
  onTransferObjective,
  onFocusObjective,
  isFocused,
  readOnly = false,
  comments = []
}) {
  // Pull groups from mainTree so we can infer sharing membership across pages
  const groups = useMainTreeStore((state) => state.mainTree?.groups || []);

  const rewardSummary = useMemo(() => {
    const counts = { medal: 0, star: 0, cookie: 0 };
    comments.forEach(comment => {
      if (comment.type !== 'text' && comment.count && counts.hasOwnProperty(comment.type)) {
        counts[comment.type] += comment.count;
      }
    });
    const total = counts.medal + counts.star + counts.cookie;
    return { counts, hasRewards: total > 0 };
  }, [comments]);

  const sharedGroups = useMemo(() => {
    const rawGroups = objective.shared_groups || objective.sharedGroups || [];
    const normalizedFromObjective = rawGroups
      .map((group, idx) => {
        if (!group) return null;
        if (typeof group === 'string') return { id: group, name: group };
        if (typeof group === 'number') return { id: group, name: String(group) };
        const name = group.name || group.group_name || group.title || group.label || group.display_name;
        const id = group.id || group.group_or_user_id || group.group_id || idx;
        if (!name) return null;
        return { id, name };
      })
      .filter(Boolean);

    const inferredFromGroups = groups
      .filter(
        (group) =>
          group &&
          Array.isArray(group.objectiveIds) &&
          group.objectiveIds.includes(objective.id)
      )
      .map((group) => ({
        id: group.id,
        name: group.name || group.title || `Group ${group.id}`
      }));

    // Deduplicate by id, fallback to name when id missing
    const deduped = new Map();
    [...normalizedFromObjective, ...inferredFromGroups].forEach((g, idx) => {
      const key = g.id ?? `${g.name}-${idx}`;
      if (!deduped.has(key)) {
        deduped.set(key, g);
      }
    });

    return Array.from(deduped.values());
  }, [objective.id, objective.shared_groups, objective.sharedGroups, groups]);

  const isShared = useMemo(() => {
    const vis = (objective.visibility || '').toString().toLowerCase();
    return vis === 'shared' || sharedGroups.length > 0;
  }, [objective.visibility, sharedGroups.length]);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'A': return 'active';
      case 'C': return 'complete';
      case 'R': return 'archived';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'A': return 'Active';
      case 'C': return 'Complete';
      case 'R': return 'Archived';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`${styles.objectiveHeader} ${!isExpanded ? styles.collapsed : ''}`}>
      <div className={styles.objectiveMainContent}>
        <div className={styles.objectiveInfo}>
            <div className={styles.objectiveIcon}>
              <GrTrophy size={20} />
            </div>
          <div>
     
            <h1
              className={styles.objectiveTitle}
              onClick={readOnly ? undefined : () => onEditObjective(objective)}
              style={readOnly ? { cursor: 'default' } : undefined}
            >
              {objective.title}
            </h1>
            <div className={styles.objectiveMeta}>
              <div className={styles.chipGroup} title={`Quarter: ${objective.cycle_qtr}`}>
                <Chip text={objective.cycle_qtr} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`Area: ${objective.area || "Personal"}`}>
                <Chip text={objective.area || "Personal"} variant="area" />
              </div>
              <div className={styles.chipGroup} title={`Status: ${getStatusLabel(objective.status)}`}>
                <Chip text={getStatusLabel(objective.status)} variant={getStatusVariant(objective.status)} />
              </div>
              {objective.owner_name && (
                <div className={styles.chipGroup} title={`Owner: ${objective.owner_name}`}>
                  <Chip text={objective.owner_name} variant="owner" />
                </div>
              )}
              <div className={styles.chipGroup} title={`Visibility: ${isShared ? 'Shared' : 'Private'}`}>
                <Chip text={isShared ? 'Shared' : 'Private'} variant={isShared ? 'shared' : 'private'} />
              </div>
              {sharedGroups.length > 0 &&
                sharedGroups.map((group) => (
                  <div key={group.id} className={styles.chipGroup} title={`Shared with group: ${group.name}`}>
                    <Chip text={group.name} variant="group" />
                  </div>
                ))}
              {rewardSummary.hasRewards && (
                <div className={styles.objectiveRewardsRow}>
                  <div className={`${styles.chip} ${styles.rewardsLabel}`} title="Rewards received">
                    Rewards
                </div>
                <RewardsDisplay comments={comments} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.objectiveActions}>
        <div className={styles.progressSection}>
            <div className={styles.progressItem}>
              <ProgressRing value={(objective.confidence ?? 0) / 100} size={64} color="var(--brand-secondary)" />
              <div className={styles.progressLabel}>confidence</div>
            </div>
            <div className={styles.progressItem}>
              <ProgressRing value={objective.progress / 100} size={64} color="var(--brand-primary)" />
              <div className={styles.progressLabel}>progress</div>
            </div>
          </div>
          <div className={styles.objectiveRightSection}>
            <div className={styles.objectiveButtons}>
              {!readOnly && onShareObjective && (
                <button
                  className={styles.shareButton}
                  onClick={() => onShareObjective(objective)}
                  title="Share this objective"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16,6 12,2 8,6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  Share
                </button>
              )}
              {!readOnly && onTransferObjective && (
                <button
                  className={styles.shareButton}
                  onClick={() => onTransferObjective(objective)}
                  title="Transfer ownership"
                >
                  <MdSwapHoriz size={16} />
                  Transfer
                </button>
              )}
              <button
                className={`${styles.shareButton} ${isFocused ? styles.focusButtonActive : ''}`}
                onClick={() => onFocusObjective(objective.id)}
                title="Focus on this objective"
              >
                <MdFilterCenterFocus size={16} />
                Focus
              </button>
              <button
                className={styles.objectiveToggleButton}
                onClick={onToggleExpanded}
                aria-label={isExpanded ? 'Collapse objective' : 'Expand objective'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`${styles.objectiveChevron} ${isExpanded ? styles.objectiveChevronExpanded : ''}`}
                >
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && objective.description && (
        <div className={styles.objectiveDescriptionContainer}>
          <p className={styles.objectiveDescription}>{objective.description}</p>
        </div>
      )}
    </div>
  );
}
