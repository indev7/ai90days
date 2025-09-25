import React from "react";
import { GiGolfFlag } from "react-icons/gi";

/**
 * 12-Week Clock (SVG)
 * - 12 week numerals, 7 daily ticks per week (black)
 * - Elapsed pastel wedge + sweep hand to current day (0..83)
 * - Concentric progress rings for each objective
 * - KR due-date flags per objective (GiGolfFlag)
 * - Legend under the clock
 */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toRad = (deg: number) => (deg - 90) * (Math.PI / 180); // 0° at 12 o'clock, clockwise

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = toRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function sectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

type KR = { title: string; dueDay: number }; // dueDay: 0..83

type Objective = {
  title: string;
  progress: number; // 0..1
  color?: string;
  krs?: KR[]; // 3–5 KRs with due dates
};

type Colors = {
  face?: string;
  elapsedFill?: string;
  ticksAndText?: string;
  tracksBg?: string;
  hand?: string; // slightly darker color for the clock hand
};

type TwelveWeekClockProps = {
  size?: number;
  dayIndex: number; // 0..83
  objectives?: Objective[];
  colors?: Colors;
  trackWidth?: number;
  trackGap?: number;
  titlePrefix?: string;
  dateLabel?: string; // e.g., "Thursday 25th, September"
};

function TwelveWeekClock({
  size = 420,
  dayIndex,
  objectives = [],
  colors = {},
  trackWidth = 14,
  trackGap = 12,
  titlePrefix = "Day",
  dateLabel,
}: TwelveWeekClockProps) {
  const TOTAL_WEEKS = 12;
  const TOTAL_DAYS = 84;
  const dIndex = clamp(Math.floor(dayIndex), 0, TOTAL_DAYS - 1);
  const dayLabel = `${titlePrefix} ${dIndex + 1}`;

  const face = colors.face ?? "#f7fbff";
  const elapsedFill = colors.elapsedFill ?? "#e8f0ff"; // soft pastel
  const ticksAndText = colors.ticksAndText ?? "#111"; // black
  const tracksBg = colors.tracksBg ?? "#e5e5e5";
  const handColor = colors.hand ?? "#bfbfbf"; // default slightly darker than tracksBg

  const PAD = 20;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - PAD;

  const ringBaseR = outerR - 40; // leave room for numbers & ticks
  const rings = objectives.map((_, i) => ringBaseR - i * (trackWidth + trackGap));

  const currentDeg = (dIndex / TOTAL_DAYS) * 360;

  // Hand geometry (bottom layer). Tip lands on inner end of week major tick.
  const handR = outerR - 12;
  const handEnd = polar(cx, cy, handR, currentDeg);
  const handAngle = toRad(currentDeg);
  const handBase = polar(cx, cy, handR - 10, currentDeg);
  const handLeft = { x: handBase.x + 6 * Math.cos(handAngle + Math.PI / 2), y: handBase.y + 6 * Math.sin(handAngle + Math.PI / 2) };
  const handRight = { x: handBase.x + 6 * Math.cos(handAngle - Math.PI / 2), y: handBase.y + 6 * Math.sin(handAngle - Math.PI / 2) };
  const handArrowPts = `${handEnd.x},${handEnd.y} ${handLeft.x},${handLeft.y} ${handRight.x},${handRight.y}`;

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i);

  // Place a KR golf flag so its base touches the ring's centerline.
  function placeKR(r: number, dueDay: number, color: string) {
    const deg = (dueDay / TOTAL_DAYS) * 360;
    const pos = polar(cx, cy, r, deg);
    const size = 22; // visibility
    return (
      <g key={`kr-${r}-${dueDay}`} transform={`translate(${pos.x - size / 2}, ${pos.y - size})`}>
        <GiGolfFlag size={size} style={{ color: ticksAndText }} />
      </g>
    );
  }

  return (
    <div className="w-full flex flex-col items-center" style={{ color: ticksAndText }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="12 week clock">
        {/* Face */}
        <circle cx={cx} cy={cy} r={outerR} fill={face} />

        {/* Elapsed pastel wedge */}
        <path d={sectorPath(cx, cy, outerR, 0, currentDeg || 0.01)} fill={elapsedFill} />

        {/* Hand (bottom layer) */}
        <line x1={cx} y1={cy} x2={handEnd.x} y2={handEnd.y} stroke={handColor} strokeWidth={2} />
        <polygon points={handArrowPts} fill={handColor} />

        {/* Objective rings + KR flags */}
        {rings.map((r, i) => {
          const obj = objectives[i];
          const color = obj?.color ?? ["#7dd71d", "#e83e8c", "#60a5fa", "#fbbf24", "#a78bfa"][i % 5];
          const prog = clamp(obj?.progress ?? 0, 0, 1);
          const endDeg = prog * 360;
          return (
            <g key={`ring-${i}`}>
              <circle cx={cx} cy={cy} r={r} stroke={tracksBg} strokeWidth={trackWidth} fill="none" />
              {prog > 0 && (
                <path d={arcPath(cx, cy, r, 0, endDeg || 0.01)} stroke={color} strokeWidth={trackWidth} fill="none" strokeLinecap="round" />
              )}
              {(obj?.krs ?? []).map((kr) => placeKR(r, clamp(kr.dueDay, 0, TOTAL_DAYS - 1), color))}
            </g>
          );
        })}

        {/* Week numbers + ticks (top text layer) */}
        {weeks.map((w) => {
          const deg = (w / TOTAL_WEEKS) * 360;
          const labelPos = polar(cx, cy, outerR - 22, deg);
          const majorIn = polar(cx, cy, outerR - 12, deg);
          const majorOut = polar(cx, cy, outerR, deg);
          const innerTicks = Array.from({ length: 7 }, (_, i) => i + 1);
          return (
            <g key={`week-${w}`} fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
              {/* Major week tick */}
              <line x1={majorIn.x} y1={majorIn.y} x2={majorOut.x} y2={majorOut.y} stroke={ticksAndText} strokeWidth={2} />
              {/* Week number */}
              <text x={labelPos.x} y={labelPos.y} fontSize={16} fill={ticksAndText} textAnchor="middle" dominantBaseline="middle">
                {w === 0 ? 12 : w}
              </text>
              {/* 7 day ticks */}
              {innerTicks.map((d) => {
                const frac = (w + d / 7) / TOTAL_WEEKS;
                const adeg = frac * 360;
                const tIn = polar(cx, cy, outerR - 4, adeg);
                const tOut = polar(cx, cy, outerR, adeg);
                return <line key={`t-${w}-${d}`} x1={tIn.x} y1={tIn.y} x2={tOut.x} y2={tOut.y} stroke={ticksAndText} strokeWidth={1} />;
              })}
            </g>
          );
        })}

        {/* Center pivot */}
        <circle cx={cx} cy={cy} r={4} fill={ticksAndText} />

        {/* Top label inside face */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize={18} fontWeight={700} fill={ticksAndText} dominantBaseline="auto">
          {dayLabel}
        </text>

        {/* Date under pivot, italic & lighter, with line break after comma */}
        {dateLabel && (
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize={12} fill={ticksAndText} opacity={0.7} fontStyle="italic">
            <tspan>{dateLabel.split(',')[0].trim()},</tspan>
            <tspan x={cx} dy={14}>{(dateLabel.split(',')[1] || '').trim()}</tspan>
          </text>
        )}
        {/* Circumference border */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={ticksAndText} strokeWidth={2} />
      </svg>

      {/* Legend */}
      {objectives.length > 0 && (
        <div
          className="mt-4 w-[min(560px,100%)] mx-auto rounded-xl border border-neutral-200 bg-white/80 shadow-sm px-4 py-3"
          style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial", textAlign: "left" }}
        >
          {objectives.map((o, i) => {
            const color = o.color ?? ["#7dd71d", "#e83e8c", "#60a5fa", "#fbbf24", "#a78bfa"][i % 5];
            const pct = Math.round(clamp(o.progress, 0, 1) * 100);
            return (
              <div key={`legend-${i}`} className="grid grid-cols-[16px_1fr] items-center gap-x-3 mb-2 last:mb-0">
                <span className="inline-block w-4 h-4 rounded" style={{ background: color }} />
                <span className="text-sm text-black">
                  {o.title} — {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Demo Preview ---
export default function Preview() {
  // Primary test case (from requirements)
  const demoObjectives: Objective[] = [
    {
      title: "Start a Blog",
      progress: 0.62,
      color: "#7dd71d",
      krs: [
        { title: "Pick niche", dueDay: 5 },
        { title: "Outline 10 posts", dueDay: 14 },
        { title: "Publish v1 site", dueDay: 28 },
        { title: "SEO baseline", dueDay: 49 },
        { title: "Post #10", dueDay: 77 },
      ],
    },
    {
      title: "Financial Freedom",
      progress: 0.3,
      color: "#e83e8c",
      krs: [
        { title: "Budget v1", dueDay: 7 },
        { title: "Cut 2 expenses", dueDay: 21 },
        { title: "Invest plan", dueDay: 42 },
        { title: "Automate savings", dueDay: 56 },
      ],
    },
    {
      title: "Fitness",
      progress: 0.45,
      color: "#60a5fa",
      krs: [
        { title: "10k steps streak", dueDay: 10 },
        { title: "5km run", dueDay: 24 },
        { title: "Bodyweight PR", dueDay: 35 },
        { title: "8% faster 5km", dueDay: 70 },
      ],
    },
  ];



  return (
    <div className="p-4 min-h-screen bg-neutral-50 flex flex-col items-center gap-10">
      <div className="flex flex-col items-center">
        <h1 className="text-xl font-semibold mb-2">12-Week Clock – Preview</h1>
        <p className="mb-4 text-sm text-neutral-600">Example with Day 28, pastel elapsed area, three objectives, and KR flags.</p>
        <TwelveWeekClock
          size={460}
          dayIndex={27} // 0-based; shows Day 28
          objectives={demoObjectives}
          colors={{ face: "#f7fbff", elapsedFill: "#e8f0ff", ticksAndText: "#000", tracksBg: "#e5e5e5", hand: "#bdbdbd" }}
          dateLabel="Thursday 25th, September"
        />
      </div>


    </div>
  );
}
