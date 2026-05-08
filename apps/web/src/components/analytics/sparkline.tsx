'use client';

interface Point {
  date: string;
  value: number;
}

interface Props {
  data: Point[];
  height?: number;
  color?: string;
  fill?: string;
}

/** Compact gold sparkline with shaded fill. SVG-only, no dependencies. */
export function Sparkline({
  data,
  height = 80,
  color = '#CBA624',
  fill = 'rgba(203,166,36,0.18)',
}: Props) {
  if (data.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-foreground/40"
      >
        Not enough data points yet to draw a trend.
      </div>
    );
  }

  const w = 600;
  const padding = 4;
  const max = Math.max(...data.map((p) => p.value), 1);

  const xAt = (i: number) =>
    padding + (i / (data.length - 1)) * (w - padding * 2);
  const yAt = (v: number) =>
    height - padding - (v / max) * (height - padding * 2);

  const linePath = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
    .join(' ');

  const areaPath =
    `M ${xAt(0).toFixed(2)} ${height - padding} ` +
    data
      .map((p, i) => `L ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
      .join(' ') +
    ` L ${xAt(data.length - 1).toFixed(2)} ${height - padding} Z`;

  const lastIdx = data.length - 1;
  const last = data[lastIdx];

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="h-auto w-full"
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={xAt(lastIdx)}
        cy={yAt(last.value)}
        r={3}
        fill={color}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={1}
      />
    </svg>
  );
}
