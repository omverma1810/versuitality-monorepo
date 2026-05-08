'use client';

import { motion } from 'framer-motion';

interface Props {
  label: string;
  value: number;
  max: number;
  rightLabel?: string;
  /** Tailwind colour class for the bar fill. */
  barClassName?: string;
}

/** Horizontal labelled bar — used for garment breakdown + stage funnel. */
export function BarRow({
  label,
  value,
  max,
  rightLabel,
  barClassName = 'bg-gradient-gold',
}: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/70">{label}</span>
        <span className="font-mono tabular-nums text-foreground/80">
          {rightLabel ?? value.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full ${barClassName}`}
        />
      </div>
    </div>
  );
}
