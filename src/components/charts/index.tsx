'use client';

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';

export type ChartDatum = { label: string; value: number };

export type ChartSeries = { name: string; data: ChartDatum[] };

export type ChartProps = {
  series: ChartSeries[];
  width?: number;
  height?: number;
  title?: string;
  summary?: string;
  className?: string;
};

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'] as const;

export function chartColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function chartMarker(index: number): string {
  return MARKERS[index % MARKERS.length];
}

function filterFinite(data: ChartDatum[]): ChartDatum[] {
  return data.filter((d) => Number.isFinite(d.value));
}

export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

export function bandScale(count: number, range: [number, number]) {
  const [r0, r1] = range;
  const step = count > 0 ? (r1 - r0) / count : 0;
  return (index: number) => r0 + step * index + step / 2;
}

export function lttb(data: ChartDatum[], threshold: number): ChartDatum[] {
  if (threshold >= data.length || threshold < 3) return data;
  const sampled: ChartDatum[] = [data[0]];
  const every = (data.length - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, data.length);
    let avgX = 0;
    let avgY = 0;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += j;
      avgY += data[j].value;
    }
    const n = rangeEnd - rangeStart || 1;
    avgX /= n;
    avgY /= n;
    const rangeOffs = Math.floor(i * every) + 1;
    const rangeTo = Math.floor((i + 1) * every) + 1;
    const pointAX = a;
    const pointAY = data[a].value;
    let maxArea = -1;
    let nextA = rangeOffs;
    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].value - pointAY) -
          (pointAX - j) * (avgY - pointAY),
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push(data[nextA]);
    a = nextA;
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}

export function useChartKeyboard(count: number) {
  const [active, setActive] = useState(0);
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (count === 0) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => (i + 1) % count);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (i - 1 + count) % count);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActive(count - 1);
      }
    },
    [count],
  );
  return { active, setActive, onKeyDown };
}

export function ChartTooltip({ label, value }: { label: string; value: number }) {
  return (
    <div role="status" aria-live="polite" className="text-sm text-slate-700 dark:text-slate-200">
      {label}: {value}
    </div>
  );
}

export function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-200">
      {series.map((s, i) => (
        <li key={s.name} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: chartColor(i) }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

export function ChartTable({ series }: { series: ChartSeries[] }) {
  return (
    <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
      <thead>
        <tr>
          <th scope="col">Label</th>
          {series.map((s) => (
            <th key={s.name} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(series[0]?.data ?? []).map((d, row) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            {series.map((s) => (
              <td key={s.name}>{s.data[row]?.value ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartFrame({
  title,
  summary,
  series,
  children,
  className,
}: ChartProps & { children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  return (
    <figure className={className}>
      {title ? <figcaption className="mb-2 font-medium">{title}</figcaption> : null}
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      <div aria-describedby={summaryId}>{showTable ? <ChartTable series={series} /> : children}</div>
      <button
        type="button"
        className="mt-2 text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-pressed={showTable}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? 'View as chart' : 'View as table'}
      </button>
      <Legend series={series} />
    </figure>
  );
}

export function LineChart(props: ChartProps) {
  const { series, width = 480, height = 200 } = props;
  const data = useMemo(() => filterFinite(series[0]?.data ?? []), [series]);
  const sampled = useMemo(() => lttb(data, 500), [data]);
  const { active, onKeyDown } = useChartKeyboard(sampled.length);
  const x = bandScale(sampled.length, [0, width]);
  const y = linearScale([0, Math.max(1, ...sampled.map((d) => d.value))], [height, 0]);
  const points = sampled.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <ChartFrame {...props}>
      <svg
        role="img"
        tabIndex={0}
        width={width}
        height={height}
        onKeyDown={onKeyDown}
        className="max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <polyline fill="none" stroke={chartColor(0)} strokeWidth={2} points={points} />
        {sampled.map((d, i) => (
          <circle
            key={d.label}
            cx={x(i)}
            cy={y(d.value)}
            r={i === active ? 5 : 3}
            fill={chartColor(0)}
          />
        ))}
      </svg>
      {sampled[active] ? <ChartTooltip label={sampled[active].label} value={sampled[active].value} /> : null}
    </ChartFrame>
  );
}

export function AreaChart(props: ChartProps) {
  const { series, width = 480, height = 200 } = props;
  const data = useMemo(() => filterFinite(series[0]?.data ?? []), [series]);
  const { active, onKeyDown } = useChartKeyboard(data.length);
  const x = bandScale(data.length, [0, width]);
  const y = linearScale([0, Math.max(1, ...data.map((d) => d.value))], [height, 0]);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <ChartFrame {...props}>
      <svg
        role="img"
        tabIndex={0}
        width={width}
        height={height}
        onKeyDown={onKeyDown}
        className="max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <polygon fill={chartColor(0)} fillOpacity={0.25} points={area} />
        <polyline fill="none" stroke={chartColor(0)} strokeWidth={2} points={line} />
        {data[active] ? <circle cx={x(active)} cy={y(data[active].value)} r={5} fill={chartColor(0)} /> : null}
      </svg>
      {data[active] ? <ChartTooltip label={data[active].label} value={data[active].value} /> : null}
    </ChartFrame>
  );
}

// Multiple series are stacked per label (series index = segment colour), so each
// bar's height is the sum across series; the table fallback lists the segments.
export function BarChart(props: ChartProps) {
  const { series, width = 480, height = 200 } = props;
  const rows = useMemo(
    () =>
      (series[0]?.data ?? []).map((d, row) => ({
        label: d.label,
        segments: series.map((s) => {
          const value = s.data[row]?.value ?? 0;
          return Number.isFinite(value) ? Math.max(0, value) : 0;
        }),
      })),
    [series],
  );
  const totals = rows.map((r) => r.segments.reduce((sum, v) => sum + v, 0));
  const { active, onKeyDown } = useChartKeyboard(rows.length);
  const x = bandScale(rows.length, [0, width]);
  const y = linearScale([0, Math.max(1, ...totals)], [height, 0]);
  const barWidth = rows.length > 0 ? width / rows.length / 2 : 0;
  return (
    <ChartFrame {...props}>
      <svg
        role="img"
        tabIndex={0}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onKeyDown={onKeyDown}
        className="h-auto max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {rows.map((r, i) => {
          let base = 0;
          return (
            <g key={r.label} opacity={i === active ? 1 : 0.85}>
              {r.segments.map((value, s) => {
                const top = y(base + value);
                const bottom = y(base);
                base += value;
                return (
                  <rect
                    key={series[s].name}
                    x={x(i) - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={bottom - top}
                    fill={chartColor(s)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {rows[active] ? <ChartTooltip label={rows[active].label} value={totals[active]} /> : null}
    </ChartFrame>
  );
}

export function DonutChart(props: ChartProps) {
  const { series, width = 200, height = 200 } = props;
  const data = useMemo(() => filterFinite(series[0]?.data ?? []), [series]);
  const { active, onKeyDown } = useChartKeyboard(data.length);
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0) || 1;
  const radius = Math.min(width, height) / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <ChartFrame {...props}>
      <svg
        role="img"
        tabIndex={0}
        width={width}
        height={height}
        onKeyDown={onKeyDown}
        className="max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {data.map((d, i) => {
            const fraction = Math.max(0, d.value) / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={d.label}
                r={radius}
                fill="none"
                stroke={chartColor(i)}
                strokeWidth={i === active ? 22 : 16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90)"
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      {data[active] ? <ChartTooltip label={data[active].label} value={data[active].value} /> : null}
    </ChartFrame>
  );
}

export function Sparkline({
  series,
  width = 120,
  height = 32,
  title,
  summary,
  className,
}: ChartProps) {
  const data = useMemo(() => filterFinite(series[0]?.data ?? []), [series]);
  const x = bandScale(data.length, [0, width]);
  const y = linearScale([0, Math.max(1, ...data.map((d) => d.value))], [height, 0]);
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const accessibleLabel = summary || title || (series[0]?.name ? `${series[0].name} trend` : 'Trend');
  return (
    <figure className={className}>
      {summary ? <p className="sr-only">{summary}</p> : null}
      <svg role="img" aria-label={accessibleLabel} width={width} height={height} className="max-w-full">
        <polyline fill="none" stroke={chartColor(0)} strokeWidth={1.5} points={points} />
      </svg>
      <div className="sr-only">
        <ChartTable series={series} />
      </div>
    </figure>
  );
}
