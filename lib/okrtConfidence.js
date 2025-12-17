const MS_PER_DAY = 24 * 60 * 60 * 1000;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const normalizeWeights = (items = []) => {
  const total = items.reduce((sum, item) => sum + (item?.weight ?? 1), 0) || 1;
  return items.map((item) => ({
    item,
    weight: (item?.weight ?? 1) / total
  }));
};

const parseCycleQuarter = (cycle_qtr) => {
  const now = new Date();
  if (!cycle_qtr || typeof cycle_qtr !== 'string') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    return { year: now.getFullYear(), quarter: currentQuarter + 1 };
  }
  const match = cycle_qtr.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    return { year: now.getFullYear(), quarter: currentQuarter + 1 };
  }
  return { year: Number(match[1]), quarter: Number(match[2]) };
};

const getQuarterWindow = (cycle_qtr, now = new Date()) => {
  const { year, quarter } = parseCycleQuarter(cycle_qtr);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  const totalDays = Math.max(1, Math.round((end - start) / MS_PER_DAY));
  const remainingDays = Math.max(0, Math.round((end - now) / MS_PER_DAY));
  return {
    start,
    end,
    totalDays,
    remainingDays,
    remainingRatio: clamp01(remainingDays / totalDays)
  };
};

const dueDatePenalty = (dueDate, progressFraction, quarterWindow, weights) => {
  if (!dueDate) return 0;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return 0;

  const now = new Date();
  const daysToDue = Math.round((parsed - now) / MS_PER_DAY);
  if (daysToDue < 0) {
    // Overdue: stronger penalty for overdue items, scaled by how late and lack of progress
    const lateness = clamp01(Math.abs(daysToDue) / Math.max(7, quarterWindow.totalDays));
    return (1 - progressFraction) * lateness * weights.overdue;
  }

  const urgency = clamp01(1 - daysToDue / Math.max(1, quarterWindow.remainingDays || 1));
  return (1 - progressFraction) * urgency * weights.upcoming;
};

const quarterTimePenalty = (progressFraction, quarterWindow, weight) => {
  const pressure = 1 - (quarterWindow?.remainingRatio ?? 1);
  return (1 - progressFraction) * pressure * weight;
};

const taskConfidence = (task, quarterWindow) => {
  const progress = clamp01((task?.progress ?? 0) / 100);
  const duePenalty = dueDatePenalty(task?.due_date, progress, quarterWindow, {
    overdue: 0.4,
    upcoming: 0.25
  });
  const timePenalty = quarterTimePenalty(progress, quarterWindow, 0.2);

  const score = progress - duePenalty - timePenalty;
  return clamp01(score);
};

const keyResultConfidence = (kr, tasks = [], quarterWindow) => {
  const childTasks = tasks.filter((t) => t?.parent_id === kr?.id);

  const childScore = childTasks.length
    ? normalizeWeights(childTasks).reduce(
        (sum, { item, weight }) => sum + weight * taskConfidence(item, quarterWindow),
        0
      )
    : null;

  const progressFraction = clamp01((kr?.progress ?? 0) / 100);
  const blended = childScore === null
    ? progressFraction
    : clamp01(childScore * 0.7 + progressFraction * 0.3);

  const duePenalty = dueDatePenalty(kr?.due_date, blended, quarterWindow, {
    overdue: 0.3,
    upcoming: 0.2
  });
  const timePenalty = quarterTimePenalty(blended, quarterWindow, 0.15);

  return clamp01(blended - duePenalty - timePenalty);
};

export const computeObjectiveConfidence = (objective, keyResults = [], tasks = []) => {
  if (!objective) return 0;

  const quarterWindow = getQuarterWindow(objective.cycle_qtr);
  const childKRs = keyResults.filter((kr) => kr?.parent_id === objective.id);

  const childScore = childKRs.length
    ? normalizeWeights(childKRs).reduce(
        (sum, { item, weight }) => sum + weight * keyResultConfidence(item, tasks, quarterWindow),
        0
      )
    : null;

  const progressFraction = clamp01((objective.progress ?? 0) / 100);
  const base = childScore === null ? progressFraction : childScore;

  const timePenalty = quarterTimePenalty(base, quarterWindow, 0.1);
  const score = clamp01(base - timePenalty);

  return Math.round(score * 100);
};

export default computeObjectiveConfidence;
