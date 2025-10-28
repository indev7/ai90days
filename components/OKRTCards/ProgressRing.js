import styles from '../../app/okrt/page.module.css';

export default function ProgressRing({ value = 0, size = 40, stroke = 6, color = "var(--brand-primary)" }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v) + 0.0001;

  return (
    <div className={styles.progressRing}>
      <svg width={size} height={size} className={styles.progressSvg}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            stroke="var(--border-light)"
            strokeOpacity="0.3"
            fill="transparent"
            strokeWidth={stroke}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeLinecap="round"
            strokeWidth={stroke}
            r={radius}
            cx={size / 2}
            cy={size / 2}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            className={styles.progressCircle}
          />
        </g>
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className={styles.progressText}
        >
          {Math.round(v * 100)}%
        </text>
      </svg>
    </div>
  );
}