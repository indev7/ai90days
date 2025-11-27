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
      totalStrategicOkrs: 0,
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

    const normalizeType = (type) => (typeof type === 'string' ? type.toLowerCase() : '');
    const isKeyResult = (okrt) => {
      const type = normalizeType(okrt?.type);
      return type === 'k' || type === 'keyresult';
    };
    const isObjective = (okrt) => {
      const type = normalizeType(okrt?.type);
      return type === 'o' || type === 'objective' || type === 'okr' || type === 'objectivenode' || type === '';
    };

    const mapKeyResults = (objective) => {
      if (!objective) return [];

      if (objective.keyResults && Array.isArray(objective.keyResults)) {
        return objective.keyResults.map((kr, idx) => ({
          id: kr.id ?? `${objective.id}-kr-${idx}`,
          title: kr.description || kr.title,
          progress: Math.round(kr.progress || 0),
        }));
      }

      return allOKRTs
        .filter((okrt) => okrt.parent_id === objective.id && isKeyResult(okrt))
        .map((kr) => ({
          id: kr.id,
          title: kr.description || kr.title,
          progress: Math.round(kr.progress || 0),
        }));
    };

    const mapChildObjectives = (objectiveId) =>
      allOKRTs
        .filter(
          (okrt) => okrt.parent_id === objectiveId && isObjective(okrt) && !isKeyResult(okrt)
        )
        .map((child, idx) => {
          const childOwnerName =
            child.owner_name ||
            [child.owner_first_name, child.owner_last_name].filter(Boolean).join(' ') ||
            'You';

          return {
            id: child.id || `${objectiveId}-child-${idx}`,
            title: child.title || child.description,
            progress: Math.round(child.progress || 0),
            ownerName: childOwnerName,
            ownerAvatar: child.owner_avatar,
            keyResults: mapKeyResults(child),
          };
        });

    const objectives = strategicObjectiveIds
      .map((objId) => {
        const objective = allOKRTs.find((okrt) => okrt.id === objId);
        if (!objective) return null;

        const ownerName =
          objective.owner_name ||
          [objective.owner_first_name, objective.owner_last_name].filter(Boolean).join(' ') ||
          'You';

        const keyResults = mapKeyResults(objective);
        const childObjectives = mapChildObjectives(objId);

        return {
          id: objective.id,
          title: objective.title,
          progress: Math.round(objective.progress || 0),
          ownerName,
          ownerAvatar: objective.owner_avatar,
          keyResults,
          childObjectives,
        };
      })
      .filter(Boolean);

    const overallProgress =
      objectives.length > 0
        ? Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length)
        : 0;

    const totalStrategicOkrs = objectives.reduce(
      (sum, o) => sum + (o.childObjectives?.length || 0),
      0
    );

    return {
      groupName: orgGroup.name || '',
      vision: orgGroup.vision || 'Define your organisation vision',
      mission: orgGroup.mission || 'Define your organisation mission',
      objectives,
      overallProgress,
      totalStrategicOkrs,
    };
  }, [mainTree]);

  const { groupName, vision, mission, objectives, overallProgress, totalStrategicOkrs } =
    strategyData;
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
          <div
            className={styles.strategyDonut}
            style={{ '--donut-value': overallProgress }}
          >
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
            <span className={styles.strategyMetricChipLabel}>Strategic OKRs</span>
            <span className={styles.strategyMetricChipValue}>{totalStrategicOkrs}</span>
          </div>
        </div>
      </div>

      <section className={styles.strategySection}>
        <div className={styles.strategySectionHeader}>
          <h2>Priorities</h2>
          <span className={styles.strategySectionCaption}>
            Strategy Pillars
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
                <div
                  className={styles.strategyProgressBar}
                  style={{ '--bar-value': `${o.progress}%` }}
                >
                  <div className={styles.strategyProgressBarFill} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.strategySection}>
        <div className={styles.strategySectionHeader}>
          <h2>Strategic OKRs</h2>
          <span className={styles.strategySectionCaption}>
            Strategic Objectives implementing the priorities.
          </span>
        </div>

        {objectives.length === 0 ? (
          <div className={styles.strategyEmpty}>Add objectives to see Strategic OKRs.</div>
        ) : (
          <div className={styles.strategyKrGrid}>
            {objectives.map((o) => (
              <div key={o.id} className={styles.strategyKrColumn}>
                <div className={styles.strategyKrColumnHeader}>
                  <div className={styles.strategyKrColumnTitle}>{o.title}</div>
                  <div className={styles.strategyKrColumnSub}>
                    {o.childObjectives.length} objective{o.childObjectives.length === 1 ? '' : 's'} ·{' '}
                    {o.progress}% overall
                  </div>
                </div>
                <div className={styles.strategyKrColumnList}>
                  {o.childObjectives.length === 0 ? (
                    <div className={styles.strategyEmpty}>No child objectives yet.</div>
                  ) : (
                    o.childObjectives.map((child) => (
                      <div
                        key={child.id}
                        className={styles.strategyChildObjectiveCard}
                        onClick={() => handleObjectiveClick(child.id)}
                        role="button"
                      >
                        <div className={styles.strategyChildHeader}>
                          <div>
                            <div className={styles.strategyChildTitle}>{child.title}</div>
                            <div className={styles.strategyChildMeta}>
                              {child.keyResults.length} key result
                              {child.keyResults.length === 1 ? '' : 's'} · {child.progress}% overall
                            </div>
                          </div>
                          <span className={styles.strategyObjectiveProgressPill}>{child.progress}%</span>
                        </div>
                        <div className={styles.strategyChildKrList}>
                          {child.keyResults.length === 0 ? (
                            <div className={styles.strategyEmptyInline}>No key results yet.</div>
                          ) : (
                            child.keyResults.map((kr) => (
                              <div
                                key={kr.id}
                                className={styles.strategyKrCard}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleObjectiveClick(child.id);
                                }}
                                role="button"
                              >
                                <div className={styles.strategyKrTitle}>{kr.title}</div>
                                <div className={styles.strategyKrMeta}>
                                  <span>{kr.progress}%</span>
                                  <div
                                    className={`${styles.strategyProgressBar} ${styles.strategyProgressBarSmall}`}
                                    style={{ '--bar-value': `${kr.progress}%` }}
                                  >
                                    <div className={styles.strategyProgressBarFill} />
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
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
