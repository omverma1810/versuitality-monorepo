'use client';

import { motion } from 'framer-motion';
import { Check, Clock } from 'lucide-react';

import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type OrderStatusEvent,
} from '@versuitality/types';

import { cn } from '@/lib/utils';

const FLOW: OrderStatus[] = [
  'order_received',
  'requirements_noted',
  'cutting_started',
  'stitching_in_progress',
  'ready_for_trial',
  'alteration_in_progress',
  'ready_for_qc',
  'ready_for_delivery',
  'delivered',
];

interface Props {
  events: OrderStatusEvent[];
  current: OrderStatus;
}

export function StatusTimeline({ events, current }: Props) {
  // Map: status → first event that hit that status (in order)
  const firstByStatus = new Map<OrderStatus, OrderStatusEvent>();
  for (const e of events) {
    if (!firstByStatus.has(e.to_status as OrderStatus)) {
      firstByStatus.set(e.to_status as OrderStatus, e);
    }
  }

  // QC rejected events sit out of the linear flow — list them separately.
  const rejections = events.filter((e) => e.to_status === 'qc_rejected');

  return (
    <div className="space-y-3">
      <ol className="relative space-y-3 pl-7">
        {FLOW.map((status, i) => {
          const event = firstByStatus.get(status);
          const isCurrent = status === current;
          const isPast = !!event && !isCurrent;
          const isFuture = !event && !isCurrent;

          return (
            <motion.li
              key={status}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative"
            >
              <span
                className={cn(
                  'absolute -left-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2',
                  isCurrent &&
                    'border-gold-500 bg-gold-500/20 text-gold-200 shadow-gold',
                  isPast && 'border-status-ready/60 bg-status-ready/20 text-emerald-200',
                  isFuture && 'border-white/10 bg-white/[0.03] text-foreground/30',
                )}
              >
                {isPast ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current" />
                )}
              </span>
              {i < FLOW.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-[19px] top-5 h-[calc(100%+12px-20px)] w-px',
                    isPast ? 'bg-status-ready/50' : 'bg-white/10',
                  )}
                />
              )}
              <div
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs transition-colors',
                  isCurrent
                    ? 'border-gold-500/40 bg-gold-500/10'
                    : 'border-white/5 bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={cn(
                      'font-medium',
                      isCurrent && 'text-gold-200',
                      isFuture && 'text-foreground/40',
                    )}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </p>
                  {event && (
                    <p className="font-mono text-[10px] text-foreground/50">
                      {new Date(event.created_at).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                {event && event.actor_name && (
                  <p className="mt-0.5 text-[11px] text-foreground/50">
                    by {event.actor_name}
                    {event.reason && (
                      <span className="text-foreground/70"> · "{event.reason}"</span>
                    )}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>

      {rejections.length > 0 && (
        <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/10 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-status-rejected" />
            QC rejections recorded
          </p>
          <ul className="space-y-1 text-xs text-red-100">
            {rejections.map((e) => (
              <li key={e.id}>
                <span className="font-mono text-[10px] text-red-200/70">
                  {new Date(e.created_at).toLocaleString()}
                </span>
                {' · '}
                <span className="text-red-100">{e.reason || '— no reason recorded —'}</span>
                <span className="ml-1 text-red-200/70">({e.actor_name})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
