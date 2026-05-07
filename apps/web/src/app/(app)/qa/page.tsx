'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  Phone,
  Receipt,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useAuthGate } from '@/hooks/useAuthGate';
import { useOrderBoardSocket } from '@/hooks/useOrderBoardSocket';
import { fetchQcQueue } from '@/lib/qa';
import type { OrderBoardEvent } from '@/lib/socket';
import type { OrderListItem } from '@versuitality/types';

export default function QcQueuePage() {
  const { ready } = useAuthGate({ roles: ['admin', 'qa'] });
  const [queue, setQueue] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchQcQueue()
      .then((data) => setQueue(data.results))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // Live: anytime a status change might have moved an order in or out of
  // the QC queue, just refetch — small payload, simpler than reconciling.
  useOrderBoardSocket(
    useCallback(
      (event: OrderBoardEvent) => {
        if (event.kind === 'hello') return;
        if (
          event.kind === 'order_status_changed' &&
          event.order.status !== 'ready_for_qc' &&
          event.previous_status !== 'ready_for_qc'
        ) {
          return;
        }
        refresh();
      },
      [refresh],
    ),
  );

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Quality assurance
          </p>
          <h1 className="font-display text-3xl gold-text">QC queue</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Orders the master has marked as ready for inspection. Run the
            structured checklist and pass or reject — passes move the order
            to ready-for-delivery; rejections start a rework loop.
          </p>
        </div>
        <div className="glass-panel hidden items-center gap-2 px-3 py-2 text-xs text-foreground/60 md:flex">
          <ClipboardCheck className="h-3.5 w-3.5 text-gold-300" />
          {queue.length} {queue.length === 1 ? 'order' : 'orders'} awaiting
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
        </div>
      ) : queue.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
          <Sparkles className="h-10 w-10 text-gold-400" />
          <p className="font-display text-xl">All caught up</p>
          <p className="max-w-md text-sm text-foreground/50">
            Nothing is waiting for QC right now. As soon as the master marks
            an order as ready for quality check it'll appear here — the page
            updates live, no refresh needed.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((order, i) => (
            <motion.li
              key={order.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/qa/${order.id}`}
                className="glass-panel group flex h-full flex-col gap-3 p-5 transition-colors hover:border-gold-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
                      {order.order_id}
                    </p>
                    <p className="truncate font-display text-base leading-tight">
                      {order.client.full_name}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold-200">
                    Inspect
                  </span>
                </div>

                {order.garment_summary && (
                  <p className="flex items-center gap-1.5 text-xs text-foreground/60">
                    <Receipt className="h-3 w-3" />
                    {order.garment_summary}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-foreground/60">
                  <Phone className="h-3 w-3" />
                  {order.client.mobile}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-foreground/50">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(order.days_since_creation ?? 0) === 0
                      ? 'Today'
                      : `${order.days_since_creation}d in production`}
                  </span>
                  <span className="flex items-center gap-1 text-gold-300 transition-transform group-hover:translate-x-1">
                    Start
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
