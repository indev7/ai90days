import { GrTrophy } from 'react-icons/gr';
import { MdFilterCenterFocus } from "react-icons/md";
import Chip from './Chip';
import ProgressRing from './ProgressRing';
import RewardsDisplay from '../RewardsDisplay';
import styles from '../../app/okrt/page.module.css';

export default function ObjectiveHeader({
  objective,
  onEditObjective,
  isExpanded,
  onToggleExpanded,
  onShareObjective,
  onFocusObjective,
  isFocused,
  readOnly = false,
  comments = []
}) {
  const getStatusVariant = (status) => {
    switch (status) {
      case 'A': return 'active';
      case 'C': return 'complete';
      case 'D': return 'draft';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'A': return 'in progress';
      case 'C': return 'Complete';
      case 'D': return 'Draft';
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
              <div className={styles.chipGroup} title={`Visibility: ${objective.visibility === 'shared' ? 'Shared' : 'Private'}`}>
                <Chip text={objective.visibility === 'shared' ? 'Shared' : 'Private'} variant={objective.visibility === 'shared' ? 'shared' : 'private'} />
              </div>
              {objective.owner_name && (
                <div className={styles.chipGroup} title={`Owner: ${objective.owner_name}`}>
                  <Chip text={objective.owner_name} variant="owner" />
                </div>
              )}
              {objective.shared_groups && objective.shared_groups.length > 0 && objective.shared_groups
                .filter(group => group && group.name)
                .map((group) => (
                  <div key={group.id} className={styles.chipGroup} title={`Shared with group: ${group.name}`}>
                    <Chip text={group.name} variant="group" />
                  </div>
                ))}
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
            <div className={styles.objectiveRewards}>
              <RewardsDisplay comments={comments} />
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
