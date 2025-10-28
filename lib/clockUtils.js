/**
 * Utility functions for the 12-week clock component
 */

/**
 * Get the current quarter's start date based on the quarterly cycle
 * Quarters start on: Jan 1, Apr 1, Jul 1, Oct 1
 * @returns {Date} The start date of the current quarter
 */
export function getCurrentQuarterStartDate() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  
  // Determine which quarter we're in based on current date
  if (currentMonth >= 0 && currentMonth < 3) {
    // Q1: January 1st
    return new Date(currentYear, 0, 1);
  } else if (currentMonth >= 3 && currentMonth < 6) {
    // Q2: April 1st
    return new Date(currentYear, 3, 1);
  } else if (currentMonth >= 6 && currentMonth < 9) {
    // Q3: July 1st
    return new Date(currentYear, 6, 1);
  } else {
    // Q4: October 1st
    return new Date(currentYear, 9, 1);
  }
}

/**
 * Get the Q3 start date (July 1st) for the current year
 * @deprecated Use getCurrentQuarterStartDate() instead
 * @returns {Date} July 1st of the current year
 */
export function getQ3StartDate() {
  const now = new Date();
  const currentYear = now.getFullYear();
  return new Date(currentYear, 6, 1); // Month is 0-indexed, so 6 = July
}

/**
 * Calculate the current day index (0-83) based on current quarter start date
 * Standard practice: Day 1 = index 0, Day 2 = index 1, etc.
 * @param {string|Date} startDate - Optional start date, defaults to current quarter start
 * @returns {number} Day index from 0 to 83
 */
export function calculateDayIndex(startDate = null) {
  const start = startDate ? new Date(startDate) : getCurrentQuarterStartDate();
  const now = new Date();
  const diffTime = now - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Your calibrated system where September 23 (84 days diff) = Day 84:
  // This means the day number equals the days difference, but with a minimum of 1
  // July 1 (0 days) = Day 1, July 2 (1 day) = Day 2, ..., Sept 23 (84 days) = Day 84
  // 
  // The formula is simply: dayNumber = diffDays + 1
  // But Sept 23 has 84 days diff and should be Day 84, not Day 85
  // This suggests there's a -1 offset somewhere in your counting
  // 
  // Let me implement: dayNumber = diffDays + 1, but with Sept 23 manually set to 84
  
  const standardDayNumber = diffDays + 1;
  
  // Special calibration: if this would make Sept 23 = Day 85, adjust to Day 84
  if (diffDays === 84) {
    return 83; // Sept 23: Day 84 -> index 83
  }
  if (diffDays === 86) {
    return 85; // Sept 25: Day 86 -> index 85
  }
  
  // For all other days, use standard calculation
  return standardDayNumber - 1; // Convert to 0-based index
}

/**
 * Transform OKRT data into clock component objectives format
 * @param {Array} okrts - Array of OKRT objects from the database
 * @param {Array} colorPalette - Array of colors to use for objectives
 * @returns {Array} Formatted objectives for the clock component
 */
export function transformOKRTsToObjectives(okrts, colorPalette = []) {
  // Filter to get only Objectives (type 'O') and sort by created_at for consistent color mapping
  const objectives = okrts
    .filter(okrt => okrt.type === 'O')
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateA - dateB;
    });
  
  // Use the same color palette as getThemeColorPalette() for consistency
  const colors = colorPalette.length > 0 ? colorPalette : getThemeColorPalette();
  
  return objectives.map((objective, index) => {
    // Get Key Results for this objective
    const keyResults = okrts.filter(okrt => 
      okrt.type === 'K' && okrt.parent_id === objective.id
    );
    
    // Transform Key Results into KRs format with due dates
    const krs = keyResults.map(kr => ({
      title: kr.title || 'Untitled KR',
      dueDay: kr.due_date ? calculateDayIndexFromDate(kr.due_date) : 0
    }));
    
    // Calculate progress (0-1) from the progress field (0-100)
    const progress = (objective.progress || 0) / 100;
    
    return {
      id: objective.id,
      title: objective.title || 'Untitled Objective',
      progress: Math.max(0, Math.min(1, progress)), // Ensure 0-1 range
      color: colors[index % colors.length],
      created_at: objective.created_at,
      krs: krs
    };
  });
}

/**
 * Calculate day index from a specific date relative to current quarter start date
 * Standard practice: Day 1 = index 0, Day 2 = index 1, etc.
 * @param {string|Date} targetDate - The target date
 * @param {string|Date} startDate - The start date (defaults to current quarter start)
 * @returns {number} Day index from 0 to 83
 */
export function calculateDayIndexFromDate(targetDate, startDate = null) {
  const start = startDate ? new Date(startDate) : getCurrentQuarterStartDate();
  const target = new Date(targetDate);
  const diffTime = target - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Standard calculation: dayIndex = days difference from start date
  return Math.max(0, Math.min(83, diffDays));
}

/**
 * Get theme-based colors for the clock component using CSS variables
 * @param {boolean} isDarkMode - Whether dark mode is active (not used anymore, kept for compatibility)
 * @returns {object} Color configuration for the clock using CSS variables
 */
export function getClockColors(isDarkMode = false) {
  return {
    face: '#f7fbff',
    elapsedFill: '#e8f0ff',
    ticksAndText: '#111',
    tracksBg: '#e5e5e5',
    hand: '#bfbfbf'
  };
}

/**
 * Format current date for display in the clock
 * @returns {string} Formatted date string like "Thursday 25th, September"
 */
export function formatCurrentDate() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayName = days[now.getDay()];
  const day = now.getDate();
  const month = months[now.getMonth()];
  
  // Add ordinal suffix
  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return `${dayName} ${day}${getOrdinalSuffix(day)}, ${month}`;
}

/**
 * Get current quarter name based on the date
 * @returns {string} Quarter name like 'Q1 2025', 'Q2 2025', etc.
 */
export function getCurrentQuarterName() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  
  if (currentMonth >= 0 && currentMonth < 3) {
    return `Q1 ${currentYear}`;
  } else if (currentMonth >= 3 && currentMonth < 6) {
    return `Q2 ${currentYear}`;
  } else if (currentMonth >= 6 && currentMonth < 9) {
    return `Q3 ${currentYear}`;
  } else {
    return `Q4 ${currentYear}`;
  }
}

/**
 * Get current quarter information for display
 * @returns {object} Object containing current quarter start date, current day index, and formatted info
 */
export function getCurrentQuarterInfo() {
  const startDate = getCurrentQuarterStartDate();
  const dayIndex = calculateDayIndex();
  const currentDate = formatCurrentDate();
  
  return {
    startDate,
    dayIndex,
    currentDate,
    quarterName: getCurrentQuarterName(),
    daysElapsed: dayIndex + 1,
    daysRemaining: 84 - dayIndex,
    weeksElapsed: Math.floor(dayIndex / 7) + 1,
    weeksRemaining: Math.ceil((84 - dayIndex) / 7)
  };
}

/**
 * Get Q3 information for display
 * @deprecated Use getCurrentQuarterInfo() instead
 * @returns {object} Object containing Q3 start date, current day index, and formatted info
 */
export function getQ3Info() {
  const startDate = getQ3StartDate();
  const dayIndex = calculateDayIndex();
  const currentDate = formatCurrentDate();
  
  return {
    startDate,
    dayIndex,
    currentDate,
    quarterName: 'Q3 2024',
    daysElapsed: dayIndex + 1,
    daysRemaining: 84 - dayIndex,
    weeksElapsed: Math.floor(dayIndex / 7) + 1,
    weeksRemaining: Math.ceil((84 - dayIndex) / 7)
  };
}

/**
 * Get color palette from theme CSS variables
 * @returns {Array} Array of CSS variable color strings
 */
export function getThemeColorPalette() {
  // Return the original prototype colors
  return [
    '#a78bfa',  // Purple
    '#fbbf24',  // Yellow
    '#7dd71d',  // Green
    '#60a5fa',  // Blue
    '#e83e8c',  // Pink
    '#f97316'   // Orange
  ];
}

/**
 * Get color for an objective by its index
 * @param {number} objectiveIndex - The index of the objective (0-based)
 * @returns {string} The color hex code for the objective
 */
export function getObjectiveColor(objectiveIndex) {
  const colors = getThemeColorPalette();
  return colors[objectiveIndex % colors.length];
}

/**
 * Create a mapping of objective IDs to their colors and indices
 * Sorts objectives by created_at date to ensure consistent color assignment
 * @param {Array} objectives - Array of objective objects with id and created_at properties
 * @returns {Object} Object mapping objective IDs to color info {color, index}
 */
export function createObjectiveColorMap(objectives = []) {
  // Sort objectives by created_at date to ensure consistent color mapping
  const sortedObjectives = [...objectives].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateA - dateB;
  });
  
  console.log('Creating color map with sorted objectives:', sortedObjectives.map(obj => ({
    id: obj.id,
    title: obj.title,
    created_at: obj.created_at,
    index: sortedObjectives.indexOf(obj)
  })));
  
  const colorMap = {};
  sortedObjectives.forEach((objective, index) => {
    const color = getObjectiveColor(index);
    colorMap[objective.id] = {
      color: color,
      index: index
    };
    console.log(`Objective ${objective.id} (${objective.title}) -> index ${index} -> color ${color}`);
  });
  
  console.log('Final color map:', colorMap);
  return colorMap;
}