import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  type OrderStatus,
  type StatusTone,
} from '@versuitality/types';

import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<StatusTone, string> = {
  received: 'border-foreground/20 bg-white/5 text-foreground/70',
  production: 'border-status-production/40 bg-status-production/15 text-blue-200',
  trial: 'border-status-trial/40 bg-status-trial/15 text-amber-200',
  rejected: 'border-status-rejected/40 bg-status-rejected/15 text-red-200',
  ready: 'border-status-ready/40 bg-status-ready/15 text-emerald-200',
  delivered: 'border-status-delivered/40 bg-status-delivered/15 text-emerald-100',
};

interface Props {
  status: OrderStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, className, size = 'sm' }: Props) {
  const tone = ORDER_STATUS_TONE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wider',
        TONE_CLASSES[tone],
        size === 'sm'
          ? 'px-2.5 py-0.5 text-[10px]'
          : 'px-3 py-1 text-xs',
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
