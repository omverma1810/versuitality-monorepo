'use client';

import { motion } from 'framer-motion';
import { Radio, RefreshCcw, WifiOff } from 'lucide-react';

import { useOrderBoardStatus } from '@/hooks/useOrderBoardSocket';
import { cn } from '@/lib/utils';

const COPY: Record<
  string,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  open: { label: 'Live', tone: 'text-emerald-300', icon: Radio },
  connecting: { label: 'Connecting…', tone: 'text-foreground/50', icon: Radio },
  reconnecting: { label: 'Reconnecting…', tone: 'text-amber-300', icon: RefreshCcw },
  closed: { label: 'Offline', tone: 'text-red-300', icon: WifiOff },
  idle: { label: 'Idle', tone: 'text-foreground/40', icon: Radio },
};

export function LiveIndicator() {
  const status = useOrderBoardStatus();
  const meta = COPY[status] ?? COPY.idle;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider md:inline-flex',
        meta.tone,
      )}
      title={`Real-time order board · ${meta.label}`}
    >
      {status === 'open' && (
        <motion.span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [1, 0.35, 1], scale: [1, 1.18, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {status !== 'open' && <Icon className="h-3 w-3" />}
      {meta.label}
    </span>
  );
}
