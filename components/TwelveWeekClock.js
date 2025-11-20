import React from "react";
import { GiGolfFlag } from "react-icons/gi";
import { FaPlus } from "react-icons/fa";
import { getCurrentQuarterName, getThemeColorPalette } from '@/lib/clockUtils';
import OKRTs from '@/components/OKRTs';
import styles from './TwelveWeekClock.module.css';

/**
 * 12-Week Clock (SVG)
 * - 12 week numerals, 7 daily ticks per week (black)
 * - Elapsed pastel wedge + sweep hand to current day (0..83)
 * - Concentric progress rings for each objective
 * - KR due-date flags per objective (GiGolfFlag)
 * - Responsive legend (right side on desktop, below on mobile)
 */

// Get colors from centralized source
const PROTOTYPE_COLORS = getThemeColorPalette();

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toRad = (deg) => (deg - 90) * (Math.PI / 180); // 0° at 12 o'clock, clockwise

function polar(cx, cy, r, angleDeg) {
  const a = toRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function sectorPath(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function TwelveWeekClock({
  size = 420,
  dayIndex,
  objectives = [],
  colors = {},
  trackWidth = 14,
  trackGap = 12,
  titlePrefix = "Day",
  dateLabel,
  startDate = null,
  onCreateObjective = null,
  okrts = [],
}) {
  const TOTAL_WEEKS = 12;
  const TOTAL_DAYS = 84;
  const rawDayIndex = Math.floor(dayIndex);
  const displayDayNumber = rawDayIndex + 1; // Allow day numbers beyond 84
  const handPosition = displayDayNumber % TOTAL_DAYS; // Use day number for proper hand position
  const quarterName = getCurrentQuarterName(); // e.g., "Q1 2025"
  const quarterLabel = quarterName.replace(/^(Q\d+)\s+(\d+)$/, '$2-$1'); // Convert to "2025-Q1" format
  const clockTitle = `${quarterLabel} 12 Week Clock`; // e.g., "2025-Q4 12 Week Clock"
  const dayLabel = `${titlePrefix} ${displayDayNumber}`;

  // Calculate date range for display
  const getStartDate = () => {
    if (startDate) return new Date(startDate);
    // Default to current quarter start date
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
  };

  const start = getStartDate();
  const end = new Date(start);
  end.setDate(start.getDate() + TOTAL_DAYS - 1); // Add 83 days to get 84 total days

  const formatStartDate = (startDate) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    const dayName = dayNames[startDate.getDay()];
    const day = startDate.getDate();
    const month = monthNames[startDate.getMonth()];
    
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
    
    return `Started on ${dayName} ${day}${getOrdinalSuffix(day)}, ${month}`;
  };

  const dateRange = formatStartDate(start);

  const face = colors.face ?? "#f7fbff";
  const elapsedFill = colors.elapsedFill ?? "#e8f0ff"; // soft pastel
  const ticksAndText = colors.ticksAndText ?? "#111"; // black for numbers/text
  const circumferenceColor = "#999"; // Match TodayClock outer circle
  const tickColor = "#999"; // Match TodayClock tick marks
  const tracksBg = colors.tracksBg ?? "#e5e5e5";
  const handColor = "#111"; // Black hand and pivot

  // Scale values based on clock size relative to original 460px
  const scaleFactor = size / 460;
  const strokeWidth = Math.max(1, Math.round(2 * scaleFactor)); // Minimum 1px stroke
  const tickStrokeWidth = Math.max(0.5, Math.round(1 * scaleFactor)); // Minimum 0.5px stroke
  const fontSize = Math.max(10, Math.round(16 * scaleFactor)); // Minimum 10px font
  const centerLabelFontSize = Math.max(12, Math.round(18 * scaleFactor)); // Minimum 12px font
  const dateLabelFontSize = Math.max(8, Math.round(12 * scaleFactor)); // Minimum 8px font
  
  const PAD = Math.round(20 * scaleFactor);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - PAD;

  const ringBaseR = outerR - Math.round(40 * scaleFactor); // leave room for numbers & ticks
  const rings = objectives.map((_, i) => ringBaseR - i * (trackWidth + trackGap));

  const currentDeg = (handPosition / TOTAL_DAYS) * 360;

  // Hand geometry (bottom layer). Reduced length by 20px total.
  const handR = outerR - Math.round(12 * scaleFactor) - 20;
  const handEnd = polar(cx, cy, handR, currentDeg);
  const handAngle = toRad(currentDeg);
  const handBase = polar(cx, cy, handR - Math.round(10 * scaleFactor), currentDeg);
  const handWidth = Math.round(6 * scaleFactor);
  const handLeft = { x: handBase.x + handWidth * Math.cos(handAngle + Math.PI / 2), y: handBase.y + handWidth * Math.sin(handAngle + Math.PI / 2) };
  const handRight = { x: handBase.x + handWidth * Math.cos(handAngle - Math.PI / 2), y: handBase.y + handWidth * Math.sin(handAngle - Math.PI / 2) };
  const handArrowPts = `${handEnd.x},${handEnd.y} ${handLeft.x},${handLeft.y} ${handRight.x},${handRight.y}`;

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i);

  // Place a KR golf flag so its base touches the ring's centerline.
  function placeKR(r, dueDay, color) {
    const deg = (dueDay / TOTAL_DAYS) * 360;
    const pos = polar(cx, cy, r, deg);
    // Scale flag size based on clock size - proportional to the original 460px size
    const scaleFactor = size / 460;
    const flagSize = Math.max(12, Math.round(22 * scaleFactor)); // Minimum 12px, scales with clock
    const verticalOffset = flagSize; // Full flag height for proper base positioning
    const horizontalOffset = flagSize / 2; // Half width for centering
    
    return (
      <g key={`kr-${r}-${dueDay}`} transform={`translate(${pos.x - horizontalOffset}, ${pos.y - verticalOffset})`}>
        <GiGolfFlag size={flagSize} style={{ color: ticksAndText }} />
      </g>
    );
  }

  return (
    <div className={styles.clockContainer} style={{ color: ticksAndText }}>
      {/* Clock with border (same style as legend) */}
      <div className={styles.clockWithBorder}>
        {/* Header with title */}
        <div className={styles.clockHeader}>
          <h3 className={styles.clockTitle}>{clockTitle}</h3>
        </div>
        
        <div className={styles.clockSvg}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="12 week clock">
          {/* SVG Definitions for Jelly Bean Effects */}
          <defs>
            {/* Gradient for jelly bean effect */}
            <linearGradient id="jellyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </linearGradient>
            
            {/* Drop shadow filter */}
            <filter id="jellyShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="1" dy="2" result="offset" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Inner glow filter */}
            <filter id="jellyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="glow" />
              <feColorMatrix in="glow" values="1 1 1 0 0  1 1 1 0 0  1 1 1 0 0  0 0 0 0.6 0" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>
          
          {/* Face */}
          <circle cx={cx} cy={cy} r={outerR} fill={face} />

          {/* Elapsed pastel wedge */}
          <path d={sectorPath(cx, cy, outerR, 0, currentDeg || 0.01)} fill={elapsedFill} />

          

          {/* Objective rings + KR flags */}
          {rings.map((r, i) => {
            const obj = objectives[i];
            const color = PROTOTYPE_COLORS[i % PROTOTYPE_COLORS.length];
            const prog = clamp(obj?.progress ?? 0, 0, 1);
            const endDeg = prog * 360;
            return (
              <g key={`ring-${i}`}>
                <circle cx={cx} cy={cy} r={r} stroke={tracksBg} strokeWidth={trackWidth} fill="none" opacity={0.6} />
                {prog > 0 && (
                  prog >= 1 ? (
                    // For 100% progress, draw a full circle instead of an arc
                    <g className={`jelly-progress-${i}`}>
                      {/* Main progress circle with jelly effect */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke={color}
                        strokeWidth={trackWidth}
                        fill="none"
                        opacity={0.85}
                        filter="url(#jellyShadow)"
                      />
                      {/* Highlight overlay for jelly effect */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke="url(#jellyGradient)"
                        strokeWidth={trackWidth * 0.8}
                        fill="none"
                        opacity={0.6}
                      />
                      {/* Inner glow */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke={color}
                        strokeWidth={trackWidth * 0.4}
                        fill="none"
                        opacity={0.8}
                        filter="url(#jellyGlow)"
                      />
                    </g>
                  ) : (
                    <g className={`jelly-progress-${i}`}>
                      {/* Main progress arc with jelly effect */}
                      <path
                        d={arcPath(cx, cy, r, 0, endDeg || 0.01)}
                        stroke={color}
                        strokeWidth={trackWidth}
                        fill="none"
                        strokeLinecap="round"
                        opacity={0.85}
                        filter="url(#jellyShadow)"
                      />
                      {/* Highlight overlay for jelly effect */}
                      <path
                        d={arcPath(cx, cy, r, 0, endDeg || 0.01)}
                        stroke="url(#jellyGradient)"
                        strokeWidth={trackWidth * 0.8}
                        fill="none"
                        strokeLinecap="round"
                        opacity={0.6}
                      />
                      {/* Inner glow */}
                      <path
                        d={arcPath(cx, cy, r, 0, endDeg || 0.01)}
                        stroke={color}
                        strokeWidth={trackWidth * 0.4}
                        fill="none"
                        strokeLinecap="round"
                        opacity={0.8}
                        filter="url(#jellyGlow)"
                      />
                    </g>
                  )
                )}
                {(obj?.krs ?? []).map((kr) => placeKR(r, clamp(kr.dueDay, 0, TOTAL_DAYS - 1), color))}
              </g>
            );
          })}

          {/* Week numbers + ticks (top text layer) */}
          {weeks.map((w) => {
            const deg = (w / TOTAL_WEEKS) * 360;
            const labelPos = polar(cx, cy, outerR - Math.round(22 * scaleFactor), deg);
            const majorIn = polar(cx, cy, outerR - Math.round(12 * scaleFactor), deg);
            const majorOut = polar(cx, cy, outerR, deg);
            const innerTicks = Array.from({ length: 7 }, (_, i) => i + 1);
            return (
              <g key={`week-${w}`} fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
                {/* Major week tick */}
                <line x1={majorIn.x} y1={majorIn.y} x2={majorOut.x} y2={majorOut.y} stroke={tickColor} strokeWidth={strokeWidth} />
                {/* Week number */}
                <text x={labelPos.x} y={labelPos.y} fontSize={fontSize} fill={ticksAndText} textAnchor="middle" dominantBaseline="middle">
                  {w === 0 ? 12 : w}
                </text>
                {/* 7 day ticks */}
                {innerTicks.map((d) => {
                  const frac = (w + d / 7) / TOTAL_WEEKS;
                  const adeg = frac * 360;
                  const tIn = polar(cx, cy, outerR - Math.round(4 * scaleFactor), adeg);
                  const tOut = polar(cx, cy, outerR, adeg);
                  return <line key={`t-${w}-${d}`} x1={tIn.x} y1={tIn.y} x2={tOut.x} y2={tOut.y} stroke={tickColor} strokeWidth={tickStrokeWidth} />;
                })}
              </g>
            );
          })}
          {/* Hand (bottom layer) - styled like Today Clock */}
          <line 
            x1={cx} 
            y1={cy} 
            x2={handEnd.x} 
            y2={handEnd.y} 
            stroke={handColor} 
            strokeWidth={Math.max(3, Math.round(4 * scaleFactor))} 
            strokeLinecap="round"
            opacity={0.7} 
          />

          {/* Center pivot */}
          <circle cx={cx} cy={cy} r={Math.max(4, Math.round(6 * scaleFactor))} fill={handColor} />

          {/* Day label - positioned above pivot for days 28-63, below for all others */}
          <text
            x={cx}
            y={displayDayNumber >= 28 && displayDayNumber <= 63
              ? cy - Math.round(28 * scaleFactor)
              : cy + Math.round(28 * scaleFactor)
            }
            textAnchor="middle"
            fontSize={centerLabelFontSize}
            fill={ticksAndText}
            opacity={0.8}
            fontWeight={600}
          >
            {dayLabel}
          </text>
          {/* Circumference border */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={circumferenceColor} strokeWidth={strokeWidth} />
        </svg>
      </div>
      
      {/* OKRTs list below the clock */}
      {okrts && okrts.length > 0 && (
        <div className={styles.okrtsSection}>
          <OKRTs okrts={okrts} />
        </div>
      )}
      </div>
    </div>
  );
}

export default TwelveWeekClock;