'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

/** Pure-SVG donut chart — no chart lib, branded gold/navy palette. */
export function Donut({
  data,
  size = 220,
  thickness = 22,
  centerLabel,
  centerValue,
}: Props) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={thickness}
            fill="none"
          />
          {total > 0 &&
            data.map((d) => {
              const len = (d.value / total) * C;
              const dasharray = `${len} ${C - len}`;
              const dashoffset = -offset;
              offset += len;
              return (
                <motion.circle
                  key={d.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  fill="none"
                  initial={{ strokeDasharray: `0 ${C}` }}
                  animate={{ strokeDasharray: dasharray }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  strokeDashoffset={dashoffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
            })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-3xl tabular-nums">
            {centerValue ?? total}
          </p>
          {centerLabel && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
              {centerLabel}
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-1.5 text-xs">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.key} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="flex-1 text-foreground/70">{d.label}</span>
              <span className={cn('font-mono tabular-nums', d.value === 0 && 'text-foreground/40')}>
                {d.value}
                <span className="ml-1 text-[10px] text-foreground/40">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
