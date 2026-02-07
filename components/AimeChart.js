import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { getThemeColorPalette } from '@/lib/clockUtils';
import styles from './AimeChart.module.css';

const MAX_POINTS = 60;
const MAX_SERIES = 6;
const COLORS = getThemeColorPalette();

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatValue = (value, format) => {
  if (value == null || value === '') return '';
  const numeric = typeof value === 'number' ? value : toNumber(value);
  if (numeric == null) return String(value);
  if (format === 'currency:LKR') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(numeric);
  }
  if (format === 'percent') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)}%`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric);
};

const validatePayload = (payload) => {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Chart payload is not an object.');
    return { errors };
  }
  if (payload.kind !== 'render_chart') errors.push('Invalid chart kind.');
  if (!['bar', 'pie', 'line'].includes(payload.chartType)) errors.push('Unsupported chart type.');
  if (!Array.isArray(payload.data) || payload.data.length === 0) errors.push('Missing chart data.');
  if (!payload.x || typeof payload.x.key !== 'string') errors.push('Missing x-axis key.');
  if (!Array.isArray(payload.series) || payload.series.length === 0) errors.push('Missing series definitions.');
  if (payload.series?.length > MAX_SERIES) errors.push('Too many series for a single chart.');
  if (payload.data?.length > MAX_POINTS) errors.push('Too many data rows for a single chart.');
  if (payload.chartType === 'pie' && payload.series?.length !== 1) {
    errors.push('Pie charts must have exactly one series.');
  }
  return { errors };
};

export default function AimeChart({ payload }) {
  const { errors } = validatePayload(payload);
  if (errors.length) {
    return (
      <div className={styles.chartError}>
        <strong>Chart not rendered.</strong>
        <div>{errors[0]}</div>
      </div>
    );
  }

  const {
    chartType,
    title,
    subtitle,
    description,
    data,
    x,
    series,
    y,
    options
  } = payload;

  const trimmedData = data.slice(0, MAX_POINTS);
  const trimmedSeries = series.slice(0, MAX_SERIES);
  const seriesMeta = new Map(
    trimmedSeries.map((s) => [s.key, { label: s.label || s.key, format: s.format }])
  );

  const showLegend = options?.showLegend ?? trimmedSeries.length > 1;
  const yFormatter = (value) => formatValue(value, y?.format);
  const baseChartHeight = 260;
  const barChartHeight = Math.max(baseChartHeight, trimmedData.length * 30 + 60);
  const containerHeight = chartType === 'bar' ? barChartHeight : baseChartHeight;

  return (
    <div className={styles.chartWrapper}>
      {(title || subtitle) && (
        <div className={styles.chartHeader}>
          {title && <div className={styles.chartTitle}>{title}</div>}
          {subtitle && <div className={styles.chartSubtitle}>{subtitle}</div>}
        </div>
      )}
      {description && <div className={styles.chartDescription}>{description}</div>}
      <div className={styles.chartContainer} style={{ height: `${containerHeight}px` }}>
        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height={barChartHeight}>
            <BarChart
              data={trimmedData}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={yFormatter} />
              <YAxis
                type="category"
                dataKey={x.key}
                width={140}
                interval={0}
                tick={{ fontSize: 12 }}
                tickMargin={6}
                label={x.label ? { value: x.label, angle: -90, position: 'insideLeft' } : undefined}
              />
              <Tooltip formatter={(value, name) => {
                const meta = seriesMeta.get(name) || {};
                return [formatValue(value, meta.format || y?.format), meta.label || name];
              }} />
              {showLegend && <Legend />}
              {trimmedSeries.map((s, idx) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label || s.key}
                  fill={COLORS[idx % COLORS.length]}
                  barSize={18}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'line' && (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trimmedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x.key} label={x.label ? { value: x.label, position: 'insideBottom', offset: -6 } : undefined} />
              <YAxis label={y?.label ? { value: y.label, angle: -90, position: 'insideLeft' } : undefined} tickFormatter={yFormatter} />
              <Tooltip formatter={(value, name) => {
                const meta = seriesMeta.get(name) || {};
                return [formatValue(value, meta.format || y?.format), meta.label || name];
              }} />
              {showLegend && <Legend />}
              {trimmedSeries.map((s, idx) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {chartType === 'pie' && (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip formatter={(value) => formatValue(value, trimmedSeries[0]?.format || y?.format)} />
              {showLegend && <Legend />}
              <Pie
                data={trimmedData.map((row) => ({
                  name: String(row?.[x.key] ?? ''),
                  value: toNumber(row?.[trimmedSeries[0].key]) ?? 0
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius={options?.pieInnerRadius || 0}
                outerRadius={90}
                paddingAngle={2}
              >
                {trimmedData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
