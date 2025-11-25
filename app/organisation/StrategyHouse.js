"use client";
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './page.module.css';

/**
 * StrategyHouse Component
 * Upgraded business strategy view using the Phase19 dashboard template.
 * @param {Object} props
 * @param {React.ReactNode} [props.toggleSlot] - Optional view toggle rendered inside the strategy surface.
 */
export default function StrategyHouse({ toggleSlot = null }) {
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const router = useRouter();

  const strategyData = useMemo(() => {
    const emptyState = {
      groupName: '',
      vision: 'No organisation group found',
      mission: 'Please create an Organisation type group to define your strategy',
      objectives: [],
      overallProgress: 0,
      totalKeyResults: 0,
    };

    if (!mainTree?.groups?.length) {
      return emptyState;
    }

    const orgGroup = mainTree.groups.find((g) => g.type === 'Organisation');
    if (!orgGroup) {
      return emptyState;
    }

    const strategicObjectiveIds = orgGroup.strategicObjectiveIds || [];
    const allOKRTs = [...(mainTree.myOKRTs || []), ...(mainTree.sharedOKRTs || [])];

    const objectives = strategicObjectiveIds
      .map((objId) => {
        const objective = allOKRTs.find((okrt) => okrt.id === objId);
        if (!objective) return null;

        let keyResults = [];
        if (objective.keyResults && Array.isArray(objective.keyResults)) {
          keyResults = objective.keyResults.map((kr, idx) => ({
            id: kr.id ?? `${objId}-kr-${idx}`,
            title: kr.description || kr.title,
            progress: Math.round(kr.progress || 0),
          }));
        } else {
          keyResults = allOKRTs
            .filter((okrt) => {
              const isChild = okrt.parent_id === objId;
              const isKR = okrt.type === 'K' || okrt.type === 'KeyResult';
              return isChild && isKR;
            })
            .map((kr) => ({
              id: kr.id,
              title: kr.description || kr.title,
              progress: Math.round(kr.progress || 0),
            }));
        }

        return {
          id: objective.id,
          title: objective.title,
          progress: Math.round(objective.progress || 0),
          ownerName: objective.owner_name,
          ownerAvatar: objective.owner_avatar,
          keyResults,
        };
      })
      .filter(Boolean);

    const overallProgress =
      objectives.length > 0
        ? Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length)
        : 0;

    const totalKeyResults = objectives.reduce((sum, o) => sum + o.keyResults.length, 0);

    return {
      groupName: orgGroup.name || '',
      vision: orgGroup.vision || 'Define your organisation vision',
      mission: orgGroup.mission || 'Define your organisation mission',
      objectives,
      overallProgress,
      totalKeyResults,
    };
  }, [mainTree]);

  const { groupName, vision, mission, objectives, overallProgress, totalKeyResults } = strategyData;
  const objectiveCount = objectives.length;

  const getInitials = (name) =>
    name
      ? name
          .split(' ')
          .filter(Boolean)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '';

  const handleObjectiveClick = (objectiveId) => {
    if (objectiveId) {
      router.push(`/shared/${objectiveId}`);
    }
  };

  return (
    <div className={styles.strategyRoot}>
      {toggleSlot && <div className={styles.strategyNavSlot}>{toggleSlot}</div>}
      <section className={styles.strategyHero}>
        <div className={styles.strategyHeroPane}>
          <div className={styles.strategyPillTag}>{groupName ? `${groupName} Vision` : 'Vision'}</div>
          <h1 className={styles.strategyHeroTitle}>{vision}</h1>
        </div>
        <div className={styles.strategyHeroPane}>
          <div className={styles.strategyPillTag}>{groupName ? `${groupName} Mission` : 'Mission'}</div>
          <h1 className={styles.strategyHeroTitle}>{mission}</h1>
        </div>
      </section>

      <div className={styles.strategyHeroMetrics}>
        <div className={styles.strategyMetricCard}>
          <div className={styles.strategyDonut} style={{ '--donut-value': overallProgress }}>
            <div className={styles.strategyDonutInner}>{overallProgress}%</div>
          </div>
          <div>
            <div className={styles.strategyMetricLabel}>Overall progress</div>
            <div className={styles.strategyMetricMain}>{overallProgress}%</div>
            <div className={styles.strategyMetricCaption}>average strategic objective</div>
          </div>
        </div>

        <div className={styles.strategyMetricInline}>
          <div className={styles.strategyMetricChip}>
            <span className={styles.strategyMetricChipLabel}>Objectives</span>
            <span className={styles.strategyMetricChipValue}>{objectiveCount}</span>
          </div>
          <div className={styles.strategyMetricChip}>
            <span className={styles.strategyMetricChipLabel}>Key Results</span>
            <span className={styles.strategyMetricChipValue}>{totalKeyResults}</span>
          </div>
        </div>
      </div>

      <section className={styles.strategySection}>
        <div className={styles.strategySectionHeader}>
          <h2>Strategic objectives</h2>
          <span className={styles.strategySectionCaption}>
            High-level focus areas for this cycle.
          </span>
        </div>

        {objectives.length === 0 ? (
          <div className={styles.strategyEmpty}>No strategic objectives yet.</div>
        ) : (
          <div className={styles.strategyObjectiveGrid}>
            {objectives.map((o) => (
              <div
                key={o.id}
                className={styles.strategyObjectiveCard}
                onClick={() => handleObjectiveClick(o.id)}
                role="button"
              >
                <div className={styles.strategyObjectiveHeader}>
                  <div className={styles.strategyObjectiveOwner}>
                    {o.ownerAvatar ? (
                      <img
                        src={o.ownerAvatar}
                        alt={o.ownerName || 'Owner'}
                        className={styles.strategyObjectiveAvatar}
                      />
                    ) : (
                      <div className={styles.strategyObjectiveAvatar}>{getInitials(o.ownerName)}</div>
                    )}
                    <span className={styles.strategyObjectiveCategory}>
                      {o.ownerName || 'Unassigned'}
                    </span>
                  </div>
                  <span className={styles.strategyObjectiveProgressPill}>{o.progress}%</span>
                </div>
                <div className={styles.strategyObjectiveTitle} title={o.title}>
                  {o.title}
                </div>
                <div className={styles.strategyProgressBar}>
                  <div
                    className={styles.strategyProgressBarFill}
                    style={{ width: `${o.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.strategySection}>
        <div className={styles.strategySectionHeader}>
          <h2>Key results by strategy</h2>
          <span className={styles.strategySectionCaption}>
            Each column tracks measurable outcomes under its strategic objective.
          </span>
        </div>

        {objectives.length === 0 ? (
          <div className={styles.strategyEmpty}>Add objectives to see key results.</div>
        ) : (
          <div
            className={styles.strategyKrGrid}
            style={{
              gridTemplateColumns: `repeat(${Math.max(objectives.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {objectives.map((o) => (
              <div key={o.id} className={styles.strategyKrColumn}>
                <div className={styles.strategyKrColumnHeader}>
                  <div className={styles.strategyKrColumnTitle}>{o.title}</div>
                  <div className={styles.strategyKrColumnSub}>
                    {o.keyResults.length} key result{o.keyResults.length === 1 ? '' : 's'} ·{' '}
                    {o.progress}% overall
                  </div>
                </div>
                <div className={styles.strategyKrColumnList}>
                  {o.keyResults.length === 0 ? (
                    <div className={styles.strategyEmpty}>No key results yet.</div>
                  ) : (
                    o.keyResults.map((kr) => (
                      <div
                        key={kr.id}
                        className={styles.strategyKrCard}
                        onClick={() => handleObjectiveClick(o.id)}
                        role="button"
                      >
                        <div className={styles.strategyKrTitle}>{kr.title}</div>
                        <div className={styles.strategyKrMeta}>
                          <span>{kr.progress}%</span>
                          <div className={`${styles.strategyProgressBar} ${styles.strategyProgressBarSmall}`}>
                            <div
                              className={styles.strategyProgressBarFill}
                              style={{ width: `${kr.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
