import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdSwapHoriz } from "react-icons/md";
import { AiOutlineEdit } from "react-icons/ai";
import { GrTrophy } from 'react-icons/gr';
import Chip from './Chip';
import ProgressRing from './ProgressRing';
import RewardsDisplay from '../RewardsDisplay';
import styles from '../../app/okrt/page.module.css';
import useMainTreeStore from '@/store/mainTreeStore';
import {
  getInitials,
  getOwnerAvatar,
  getOwnerName,
  getInitiativeCount,
  getKpiCount,
  getKrCount
} from '../sharedObjectiveCardUtils';
import { buildObjectiveMinimalContextBlock, objectiveVisibilityAudience } from '@/lib/aime/contextBuilders';

const AIME_CONTEXT_DRAFT_KEY = 'aime-objective-context-draft';


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
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const [isAudienceOpen, setIsAudienceOpen] = useState(false);
  const router = useRouter();

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

  const ownerName = getOwnerName(objective);
  const ownerAvatar = getOwnerAvatar(objective);

  const audience = useMemo(
    () => objectiveVisibilityAudience(mainTree, objective?.id),
    [mainTree, objective?.id]
  );
  const audienceCount = audience.length;
  const audiencePreview = audience.slice(0, 5);

  const { initiativeCount, kpiCount, krCount, childCount } = useMemo(() => {
    const inits = getInitiativeCount(objective);
    const kpis = getKpiCount(objective);
    const krs = getKrCount(objective);
    const allItems = readOnly ? (mainTree?.sharedOKRTs || []) : (mainTree?.myOKRTs || []);
    const objectiveItems = allItems.filter(
      (item) => item && (item.type === 'O' || item.type == null)
    );
    const children = objectiveItems.filter(
      (item) => String(item?.parent_id || '') === String(objective?.id || '')
    );
    return {
      initiativeCount: Number.isFinite(inits) ? inits : 0,
      kpiCount: Number.isFinite(kpis) ? kpis : 0,
      krCount: Number.isFinite(krs) ? krs : 0,
      childCount: children.length
    };
  }, [objective, mainTree, readOnly]);

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

  const handleAimeContextClick = () => {
    if (typeof window === 'undefined') return;
    const context = buildObjectiveMinimalContextBlock(mainTree, objective?.id);
    if (!context) return;
    const payload = {
      type: 'objective_focus',
      createdAt: new Date().toISOString(),
      context
    };
    window.localStorage.setItem(AIME_CONTEXT_DRAFT_KEY, JSON.stringify(payload));
    router.push('/aime');
  };

  return (
    <div className={`${styles.objectiveHeader} ${!isExpanded ? styles.collapsed : ''}`}>
      <div className={styles.objectiveMainContent}>
        <div className={styles.objectiveInfo}>
          <div className={styles.objectiveIcon}>
              <GrTrophy size={20} />
            </div>
          <div className={styles.objectiveTextBlock}>
     
            <h1
              className={styles.objectiveTitle}
              onClick={
                readOnly || !onFocusObjective
                  ? undefined
                  : () => onFocusObjective(objective.id)
              }
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
              <div className={styles.chipGroup} title={`Initiatives: ${initiativeCount}`}>
                <Chip text={`Inits:${initiativeCount}`} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`KPIs: ${kpiCount}`}>
                <Chip text={`KPIs:${kpiCount}`} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`KRs: ${krCount}`}>
                <Chip text={`KRs:${krCount}`} variant="default" />
              </div>
              <div className={styles.chipGroup} title={`Children: ${childCount}`}>
                <Chip text={`Children:${childCount}`} variant="default" />
              </div>
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
                  className={`${styles.shareButton} ${isShared ? styles.shareButtonShared : ''}`}
                  onClick={() => onShareObjective(objective)}
                  title="Share this objective"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16,6 12,2 8,6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  {isShared ? 'Shared' : 'Share'}
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
              {!readOnly && (
                <button
                  className={`${styles.shareButton} ${isFocused ? styles.focusButtonActive : ''}`}
                  onClick={
                    !onEditObjective
                      ? undefined
                      : () => onEditObjective(objective)
                  }
                  title="Edit this objective"
                >
                  <AiOutlineEdit size={16} />
                  Edit
                </button>
              )}
              <button
                className={styles.shareButton}
                onClick={handleAimeContextClick}
                title="Send objective context to Aime"
              >
                <img src="/aime_app_icon.svg" alt="" width={16} height={16} />
                Aime
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.objectiveFooterRow}>
        {sharedGroups.length > 0 && (
          <div className={styles.objectiveSharedRow}>
            <div className={styles.objectiveSharedOwner}>
              <span className={styles.objectiveSharedLabel}>Owner:</span>
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt={ownerName}
                  className={styles.ownerAvatarMini}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={styles.ownerInitialsMini}>
                  {getInitials(ownerName)}
                </div>
              )}
              <span className={styles.ownerNameMini}>{ownerName}</span>
            </div>
            <div className={styles.objectiveSharedLabel}>Shared With:</div>
            {sharedGroups.map((group) => (
              <div key={group.id} className={styles.chipGroup} title={`Shared with group: ${group.name}`}>
                <Chip text={group.name} variant="group" />
              </div>
            ))}
            {audienceCount > 0 && (
              <>
                <div className={styles.objectiveSharedLabel}>Audience:</div>
                <div className={styles.audienceAvatars}>
                  {audiencePreview.map((member) => {
                    const memberName = `${member?.first_name || ''} ${member?.last_name || ''}`.trim() || 'Unknown';
                    return (
                      <div
                        key={member.id || memberName}
                        className={styles.ownerInitialsMini}
                        title={memberName}
                      >
                        {getInitials(memberName)}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.audienceLink}
                  onClick={() => setIsAudienceOpen(true)}
                >
                  {audienceCount} viewers
                </button>
              </>
            )}
          </div>
        )}
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
      {isAudienceOpen && (
        <div className={styles.audienceOverlay} onClick={() => setIsAudienceOpen(false)}>
          <div className={styles.audienceModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.audienceHeader}>
              <div className={styles.audienceTitle}>Audience</div>
              <button
                type="button"
                className={styles.audienceClose}
                onClick={() => setIsAudienceOpen(false)}
                aria-label="Close audience list"
              >
                ×
              </button>
            </div>
            <div className={styles.audienceList}>
              {audience.map((member) => {
                const memberName = `${member?.first_name || ''} ${member?.last_name || ''}`.trim() || 'Unknown';
                return (
                  <div key={member.id || memberName} className={styles.audienceListItem}>
                    {memberName}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {isExpanded && objective.description && (
        <div className={styles.objectiveDescriptionContainer}>
          <p className={styles.objectiveDescription}>{objective.description}</p>
        </div>
      )}
    </div>
  );
}
