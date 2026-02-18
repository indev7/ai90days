"use client";
import React, { useMemo, useState } from 'react';
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
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const RAG_FIELD_ID = 'customfield_11331';

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

    const groups = mainTree.groups || [];
    const groupsById = new Map(groups.map((g) => [g.id, g]));
    const findTopOrganisationForGroup = (groupId) => {
      let currentId = groupId;
      let topOrg = null;
      const visited = new Set();
      while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
        visited.add(currentId);
        const currentGroup = groupsById.get(currentId);
        if (!currentGroup) return topOrg;
        if (currentGroup.type === 'Organisation') {
          topOrg = currentGroup;
        }
        currentId = currentGroup.parent_group_id;
      }
      return topOrg;
    };

    const memberGroups = groups.filter((g) => g.is_member);
    let orgGroup = null;
    for (const group of memberGroups) {
      orgGroup = findTopOrganisationForGroup(group.id);
      if (orgGroup) break;
    }

    if (!orgGroup) {
      orgGroup = groups.find((g) => g.type === 'Organisation');
    }
    if (!orgGroup) {
      return emptyState;
    }

    const strategicObjectiveIds = orgGroup.strategicObjectiveIds || [];
    const allOKRTsRaw = [...(mainTree.myOKRTs || []), ...(mainTree.sharedOKRTs || [])];
    const allOKRTs = allOKRTsRaw.reduce((acc, okrt) => {
      const okrtId = okrt?.id;
      if (!okrtId) {
        acc.push(okrt);
        return acc;
      }
      if (!acc.some((item) => item?.id === okrtId)) {
        acc.push(okrt);
      }
      return acc;
    }, []);

    const normalizeType = (type) => (typeof type === 'string' ? type.toLowerCase() : '');
    const normalizeKey = (value) => String(value || '').trim().toUpperCase();
    const isValidKey = (value) => /^[A-Z][A-Z0-9]+-\d+$/.test(value);
    const initiatives = Array.isArray(mainTree?.initiatives) ? mainTree.initiatives : [];
    const initiativesByKey = initiatives.reduce((acc, initiative) => {
      const key = normalizeKey(initiative?.key);
      if (key) {
        acc.set(key, initiative);
      }
      return acc;
    }, new Map());
    const isKeyResult = (okrt) => {
      const type = normalizeType(okrt?.type);
      return type === 'k' || type === 'keyresult';
    };
    const isTask = (okrt) => {
      const type = normalizeType(okrt?.type);
      return type === 't' || type === 'task';
    };
    const isObjective = (okrt) => {
      const type = normalizeType(okrt?.type);
      return type === 'o' || type === 'objective' || type === 'okr' || type === 'objectivenode' || type === '';
    };

    const mapTasks = (kr) =>
      allOKRTs
        .filter((okrt) => okrt.parent_id === kr.id && isTask(okrt))
        .reduce((acc, task, idx) => {
          const taskId = task.id || `${kr.id}-task-${idx}`;
          if (acc.some((t) => t.id === taskId)) {
            return acc;
          }
          acc.push({
            id: taskId,
            title: task.title || task.description,
            progress: Math.round(task.progress || 0),
          });
          return acc;
        }, []);

    const mapKeyResults = (objective) => {
      if (!objective) return [];

      if (objective.keyResults && Array.isArray(objective.keyResults)) {
        return objective.keyResults.map((kr, idx) => ({
          id: kr.id ?? `${objective.id}-kr-${idx}`,
          title: kr.description || kr.title,
          progress: Math.round(kr.progress || 0),
          tasks: mapTasks(kr),
        }));
      }

      return allOKRTs
        .filter((okrt) => okrt.parent_id === objective.id && isKeyResult(okrt))
        .map((kr) => ({
          id: kr.id,
          title: kr.description || kr.title,
          progress: Math.round(kr.progress || 0),
          tasks: mapTasks(kr),
        }));
    };

    const mapLinkedInitiatives = (okrt) => {
      const rawLinks = okrt?.jira_links || okrt?.jiraLinks || [];
      const jiraKeys = rawLinks
        .map((link) => (typeof link === 'string' ? link : link?.jira_ticket_id))
        .map(normalizeKey)
        .filter((key) => isValidKey(key));
      return jiraKeys
        .map((key) => initiativesByKey.get(key))
        .filter(Boolean);
    };

    const mapChildObjectives = (objectiveId) =>
      allOKRTs
        .filter(
          (okrt) => okrt.parent_id === objectiveId && isObjective(okrt) && !isKeyResult(okrt)
        )
        .reduce((acc, child, idx) => {
          const childId = child.id || `${objectiveId}-child-${idx}`;
          if (acc.some((c) => c.id === childId)) {
            return acc;
          }

          const childOwnerName =
            child.owner_name ||
            [child.owner_first_name, child.owner_last_name].filter(Boolean).join(' ') ||
            'You';

          acc.push({
            id: childId,
            title: child.title || child.description,
            progress: Math.round(child.progress || 0),
            ownerName: childOwnerName,
            ownerAvatar: child.owner_avatar,
            keyResults: mapKeyResults(child),
            linkedInitiatives: mapLinkedInitiatives(child),
          });
          return acc;
        }, []);

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

  const toggleTasks = (krId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(krId)) {
        next.delete(krId);
      } else {
        next.add(krId);
      }
      return next;
    });
  };

  const getRagClassName = (ragValue) => {
    const normalized = (ragValue || '').toString().toLowerCase();
    if (normalized.includes('green')) return styles.strategyInitiativeRagGreen;
    if (normalized.includes('amber') || normalized.includes('yellow')) return styles.strategyInitiativeRagAmber;
    if (normalized.includes('red')) return styles.strategyInitiativeRagRed;
    return styles.strategyInitiativeRagUnknown;
  };

  const extractRagValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const first = value.find(Boolean);
      return extractRagValue(first);
    }
    if (typeof value === 'object') {
      return value.value || value.name || value.label || value.status || '';
    }
    return String(value);
  };

  const getInitiativeTitle = (initiative) =>
    initiative?.summary || initiative?.title || initiative?.name || initiative?.key || 'Untitled initiative';

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
                <div className={styles.strategyObjectiveMeta}>
                  {(o.childObjectives?.length || 0)} objective{o.childObjectives?.length === 1 ? '' : 's'} · {o.progress}% overall
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
                            <div className={styles.strategyChildOwner}>
                              {child.ownerAvatar ? (
                                <img
                                  src={child.ownerAvatar}
                                  alt={child.ownerName || 'Owner'}
                                  className={styles.strategyChildAvatar}
                                />
                              ) : (
                                <div className={styles.strategyChildAvatar}>
                                  {getInitials(child.ownerName)}
                                </div>
                              )}
                              <span className={styles.strategyChildOwnerName}>
                                {child.ownerName || 'Unassigned'}
                              </span>
                            </div>
                          </div>
                          <span className={styles.strategyObjectiveProgressPill}>{child.progress}%</span>
                        </div>
                        <div className={styles.strategyChildKrList}>
                          {child.linkedInitiatives?.length > 0 && (
                            <div className={styles.strategyInitiativeList}>
                              <div className={styles.strategyInitiativeTitleLabel}>Initiatives</div>
                              {child.linkedInitiatives.map((initiative) => {
                                const ragValue = extractRagValue(
                                  initiative?.customFields?.[RAG_FIELD_ID]
                                );
                                return (
                                  <div
                                    key={initiative.key || initiative.id}
                                    className={styles.strategyInitiativeRow}
                                  >
                                    <span
                                      className={`${styles.strategyInitiativeDot} ${getRagClassName(ragValue)}`}
                                      title={ragValue ? `RAG: ${ragValue}` : 'RAG: Unknown'}
                                      aria-hidden="true"
                                    />
                                    <span className={styles.strategyInitiativeTitle}>
                                      {getInitiativeTitle(initiative)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className={styles.strategyChildMetaInline}>
                            {child.keyResults.length} key result
                            {child.keyResults.length === 1 ? '' : 's'}
                          </div>
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
                                <div className={styles.strategyKrHeader}>
                                  <div>
                                    <div className={styles.strategyKrTitle}>{kr.title}</div>
                                    <div className={styles.strategyKrMeta}>
                                      <span className={styles.strategyKrMetaLabel}>Key Result</span>
                                    </div>
                                  </div>
                                  {kr.tasks?.length > 0 && (
                                    <button
                                      className={styles.strategyKrToggle}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTasks(kr.id);
                                      }}
                                      aria-label={
                                        expandedTasks.has(kr.id)
                                          ? 'Hide tasks'
                                          : 'Show tasks'
                                      }
                                    >
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className={`${styles.strategyKrToggleIcon} ${
                                          expandedTasks.has(kr.id)
                                            ? styles.strategyKrToggleIconOpen
                                            : ''
                                        }`}
                                      >
                                        <polyline points="9,18 15,12 9,6" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                {expandedTasks.has(kr.id) && kr.tasks?.length > 0 && (
                                  <div className={styles.strategyTaskList}>
                                    {kr.tasks.map((task) => (
                                      <div key={task.id} className={styles.strategyTaskItem}>
                                        <div className={styles.strategyTaskTitle}>{task.title}</div>
                                        <div className={styles.strategyTaskMeta}>
                                          <span>{task.progress}%</span>
                                          <div
                                            className={`${styles.strategyProgressBar} ${styles.strategyProgressBarSmall}`}
                                            style={{ '--bar-value': `${task.progress}%` }}
                                          >
                                            <div className={styles.strategyProgressBarFill} />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
