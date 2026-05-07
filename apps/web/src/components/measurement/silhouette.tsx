'use client';

import { motion } from 'framer-motion';

import type { MeasurementKey } from '@versuitality/types';

import { cn } from '@/lib/utils';

interface SilhouetteProps {
  active: MeasurementKey | null;
  className?: string;
}

interface Hotspot {
  key: MeasurementKey;
  cx: number;
  cy: number;
  side: 'upper' | 'lower';
  /** Anchor for the label so it doesn't overlap the figure. */
  label: { x: number; y: number; align: 'left' | 'right' };
  text: string;
}

// All coordinates are in the SVG viewport [0..400, 0..560].
// Upper figure occupies x∈[60, 200], lower figure occupies x∈[220, 360].
const HOTSPOTS: Hotspot[] = [
  // Upper — shirt / kurta / blazer
  { key: 'upper_collar',    cx: 130, cy: 86,  side: 'upper', label: { x: 56,  y: 84,  align: 'left'  }, text: 'Collar' },
  { key: 'upper_shoulder',  cx: 102, cy: 110, side: 'upper', label: { x: 56,  y: 110, align: 'left'  }, text: 'Shoulder' },
  { key: 'upper_chest',     cx: 130, cy: 170, side: 'upper', label: { x: 200, y: 158, align: 'right' }, text: 'Chest' },
  { key: 'upper_waist',     cx: 130, cy: 220, side: 'upper', label: { x: 200, y: 220, align: 'right' }, text: 'Waist' },
  { key: 'upper_hip',       cx: 130, cy: 270, side: 'upper', label: { x: 200, y: 270, align: 'right' }, text: 'Hip' },
  { key: 'upper_arms',      cx: 80,  cy: 175, side: 'upper', label: { x: 56,  y: 175, align: 'left'  }, text: 'Arms / Biceps' },
  { key: 'upper_sleeve',    cx: 60,  cy: 230, side: 'upper', label: { x: 50,  y: 230, align: 'left'  }, text: 'Sleeve (full)' },
  { key: 'upper_half_sleeve', cx: 70, cy: 175, side: 'upper', label: { x: 50, y: 200, align: 'left'  }, text: '½ Sleeve' },
  { key: 'upper_cuff',      cx: 56,  cy: 280, side: 'upper', label: { x: 50,  y: 280, align: 'left'  }, text: 'Cuff' },
  { key: 'upper_length',    cx: 178, cy: 320, side: 'upper', label: { x: 200, y: 320, align: 'right' }, text: 'Length' },

  // Lower — pant / trouser
  { key: 'lower_waist',     cx: 290, cy: 220, side: 'lower', label: { x: 360, y: 220, align: 'right' }, text: 'Waist' },
  { key: 'lower_seat_round',cx: 290, cy: 252, side: 'lower', label: { x: 360, y: 252, align: 'right' }, text: 'Seat round' },
  { key: 'lower_hip',       cx: 290, cy: 285, side: 'lower', label: { x: 360, y: 285, align: 'right' }, text: 'Hip' },
  { key: 'lower_thigh',     cx: 270, cy: 335, side: 'lower', label: { x: 232, y: 335, align: 'left'  }, text: 'Thigh' },
  { key: 'lower_inseam',    cx: 285, cy: 400, side: 'lower', label: { x: 360, y: 400, align: 'right' }, text: 'Inseam' },
  { key: 'lower_knee',      cx: 280, cy: 430, side: 'lower', label: { x: 232, y: 430, align: 'left'  }, text: 'Knee' },
  { key: 'lower_length',    cx: 296, cy: 330, side: 'lower', label: { x: 360, y: 330, align: 'right' }, text: 'Length' },
  { key: 'lower_bottom',    cx: 286, cy: 510, side: 'lower', label: { x: 360, y: 510, align: 'right' }, text: 'Bottom' },
];

function Figure({ side }: { side: 'upper' | 'lower' }) {
  const cx = side === 'upper' ? 130 : 290;
  return (
    <g
      stroke="#CBA624"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={0.85}
    >
      {/* Head */}
      {side === 'upper' && (
        <>
          <circle cx={cx} cy={62} r={20} />
          <line x1={cx} y1={82} x2={cx} y2={92} />
        </>
      )}

      {side === 'upper' ? (
        <>
          {/* Shoulders + torso outline */}
          <path
            d={`M ${cx - 50} 110 Q ${cx} 96 ${cx + 50} 110
                L ${cx + 46} 220
                Q ${cx + 38} 270 ${cx + 30} 320
                L ${cx - 30} 320
                Q ${cx - 38} 270 ${cx - 46} 220 Z`}
          />
          {/* Arms */}
          <path
            d={`M ${cx - 50} 110 Q ${cx - 70} 170 ${cx - 70} 220
                Q ${cx - 70} 260 ${cx - 56} 295
                L ${cx - 50} 300`}
          />
          <path
            d={`M ${cx + 50} 110 Q ${cx + 70} 170 ${cx + 70} 220
                Q ${cx + 70} 260 ${cx + 56} 295
                L ${cx + 50} 300`}
          />
          {/* Centre seam hint */}
          <line x1={cx} y1={110} x2={cx} y2={320} strokeDasharray="2 4" opacity={0.4} />
        </>
      ) : (
        <>
          {/* Pant outline */}
          <path
            d={`M ${cx - 35} 220 L ${cx + 35} 220
                L ${cx + 38} 290
                L ${cx + 32} 530
                L ${cx + 8} 530
                L ${cx + 4} 320
                L ${cx - 4} 320
                L ${cx - 8} 530
                L ${cx - 32} 530
                L ${cx - 38} 290 Z`}
          />
          {/* Centre seam hint */}
          <line x1={cx} y1={220} x2={cx} y2={290} strokeDasharray="2 4" opacity={0.4} />
        </>
      )}
    </g>
  );
}

export function Silhouette({ active, className }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 400 560"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Body measurement reference"
    >
      <defs>
        <radialGradient id="sil-bg" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#3A2F6D" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0A0818" stopOpacity="0" />
        </radialGradient>
        <filter id="hot-glow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="400" height="560" fill="url(#sil-bg)" />

      {/* Section labels */}
      <text x="130" y="32" textAnchor="middle" fill="#CBA624" fontSize="11"
            fontFamily="Inter, system-ui" letterSpacing="2" opacity="0.7">
        UPPER
      </text>
      <text x="290" y="32" textAnchor="middle" fill="#CBA624" fontSize="11"
            fontFamily="Inter, system-ui" letterSpacing="2" opacity="0.7">
        LOWER
      </text>

      <Figure side="upper" />
      <Figure side="lower" />

      {HOTSPOTS.map((h) => {
        const isActive = active === h.key;
        return (
          <g key={h.key} style={{ transition: 'opacity 200ms' }}
             opacity={!active || isActive ? 1 : 0.35}>
            {isActive && (
              <motion.circle
                cx={h.cx}
                cy={h.cy}
                r={6}
                fill="none"
                stroke="#CBA624"
                strokeWidth={1.5}
                initial={{ r: 6, opacity: 0.6 }}
                animate={{ r: [6, 14, 6], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <circle
              cx={h.cx}
              cy={h.cy}
              r={isActive ? 4.5 : 3}
              fill={isActive ? '#E2C23E' : '#CBA624'}
              filter={isActive ? 'url(#hot-glow)' : undefined}
            />
            <text
              x={h.label.x}
              y={h.label.y}
              fill={isActive ? '#E2C23E' : 'rgba(255,255,255,0.55)'}
              fontSize={isActive ? 11 : 10}
              fontFamily="Inter, system-ui"
              fontWeight={isActive ? 600 : 400}
              textAnchor={h.label.align === 'right' ? 'start' : 'end'}
              dominantBaseline="middle"
            >
              {h.text}
            </text>
            <line
              x1={h.cx}
              y1={h.cy}
              x2={h.label.align === 'right' ? h.label.x - 4 : h.label.x + 4}
              y2={h.label.y}
              stroke={isActive ? '#CBA624' : 'rgba(203,166,36,0.25)'}
              strokeWidth={isActive ? 1 : 0.6}
              strokeDasharray="2 3"
            />
          </g>
        );
      })}
    </svg>
  );
}
