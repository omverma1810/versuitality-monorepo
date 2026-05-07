'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  IndianRupee,
  Phone,
  Receipt,
  Ruler,
  Send,
  StickyNote,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StatusBadge } from '@/components/orders/status-badge';
import { StatusTimeline } from '@/components/orders/status-timeline';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { getOrder, openOrderPdf, transitionOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import {
  GARMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  type Order,
  type OrderStatus,
} from '@versuitality/types';

const REQUIRES_REASON: OrderStatus[] = ['qc_rejected'];

export default function OrderDetailPage() {
  const { ready } = useAuthGate({
    roles: ['admin', 'staff', 'master', 'qa', 'accountant'],
  });
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(search.get('welcome') === '1');

  const [transitionTarget, setTransitionTarget] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getOrder(params.id as string)
      .then((o) => !cancelled && setOrder(o))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ready, params.id]);

  useEffect(() => {
    if (welcome) {
      const t = setTimeout(() => setWelcome(false), 4500);
      return () => clearTimeout(t);
    }
  }, [welcome]);

  if (!ready || !order) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
      </div>
    );
  }

  async function applyTransition(target: OrderStatus) {
    if (!order) return;
    if (REQUIRES_REASON.includes(target) && !reason.trim()) {
      setTransitionTarget(target);
      return;
    }
    setTransitioning(true);
    setError(null);
    try {
      const data = await transitionOrder(order.id, target, reason);
      setOrder(data.order);
      setTransitionTarget(null);
      setReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update status.');
    } finally {
      setTransitioning(false);
    }
  }

  async function downloadPdf() {
    if (!order) return;
    setDownloading(true);
    try {
      await openOrderPdf(order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
          Order
        </p>
      </div>

      {welcome && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-status-ready/40 bg-status-ready/10 px-4 py-2 text-sm text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          Order saved. The PDF receipt is ready to download.
        </motion.div>
      )}

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Header card */}
      <section className="glass-panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-gold-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-gold-300/80">
              {order.order_id}
            </p>
            <h1 className="mt-1 font-display text-3xl gold-text">
              {order.client.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
              <Link
                href={`/clients/${order.client.id}`}
                className="flex items-center gap-1 text-foreground/70 hover:text-gold-300"
              >
                <Avatar name={order.client.full_name} size={20} />
                {order.client.client_id}
              </Link>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.client.mobile}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(order.created_at).toLocaleString()}
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {ORDER_TYPE_LABELS[order.order_type]}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <StatusBadge status={order.status} size="md" />
            <Button onClick={downloadPdf} loading={downloading} variant="secondary">
              <Download className="h-4 w-4" />
              PDF receipt
            </Button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KV
            label="Subtotal"
            value={`₹ ${Number(order.subtotal).toLocaleString()}`}
          />
          <KV
            label="Advance"
            value={`₹ ${Number(order.advance).toLocaleString()}`}
          />
          <KV
            label="Balance"
            value={`₹ ${Number(order.balance).toLocaleString()}`}
            tone="gold"
          />
          <KV
            label="Trial"
            value={
              order.trial_date
                ? new Date(order.trial_date).toLocaleDateString()
                : '—'
            }
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Line items */}
          <section className="glass-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gold-400" />
              <h2 className="font-display text-lg">Garments</h2>
            </div>
            <ul className="space-y-2">
              {order.line_items.map((li, i) => (
                <li
                  key={li.id ?? i}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {li.quantity} ×{' '}
                      {GARMENT_LABELS[li.garment_type as keyof typeof GARMENT_LABELS] ||
                        li.garment_type}
                    </p>
                    <p className="font-mono tabular-nums text-foreground/70">
                      ₹ {Number(li.line_total ?? Number(li.unit_price) * li.quantity).toLocaleString()}
                    </p>
                  </div>
                  {li.fabric_description && (
                    <p className="mt-1 text-xs text-foreground/60">
                      Fabric · {li.fabric_description}
                    </p>
                  )}
                  {li.customization_notes && (
                    <p className="mt-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs text-foreground/70">
                      {li.customization_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Notes */}
          {order.notes && (
            <section className="glass-panel p-5">
              <div className="mb-2 flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Notes</h2>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground/80">
                {order.notes}
              </p>
            </section>
          )}

          {/* Measurements link */}
          <section className="glass-panel flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
                <Ruler className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Measurement set</p>
                <p className="text-xs text-foreground/50">
                  {order.measurement_set
                    ? 'Linked to a captured visit — included in the PDF.'
                    : 'No measurement set linked yet.'}
                </p>
              </div>
            </div>
            <Link
              href={`/clients/${order.client.id}`}
              className="text-xs text-gold-300 hover:underline"
            >
              View on client →
            </Link>
          </section>
        </div>

        {/* Right column — actions + timeline */}
        <div className="space-y-4">
          <section className="glass-panel p-5">
            <h2 className="mb-3 font-display text-lg">Update status</h2>
            {(order.next_statuses?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-foreground/50">
                {order.status === 'delivered'
                  ? 'This order is delivered. ✦'
                  : 'No further transitions available from your role.'}
              </p>
            ) : (
              <div className="space-y-2">
                {order.next_statuses!.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => {
                      if (REQUIRES_REASON.includes(target)) {
                        setTransitionTarget(target);
                      } else {
                        applyTransition(target);
                      }
                    }}
                    disabled={transitioning}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                      target === 'qc_rejected'
                        ? 'border-status-rejected/30 bg-status-rejected/5 hover:border-status-rejected/50 hover:bg-status-rejected/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-gold-500/30 hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Send className="h-3.5 w-3.5 text-gold-400" />
                      Move to <strong className="font-medium">{ORDER_STATUS_LABELS[target]}</strong>
                    </span>
                    <span className="text-foreground/40">→</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel p-5">
            <h2 className="mb-3 font-display text-lg">Timeline</h2>
            <StatusTimeline events={order.status_events} current={order.status} />
          </section>
        </div>
      </div>

      <AnimatePresence>
        {transitionTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !transitioning && setTransitionTarget(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
                    Reason required
                  </p>
                  <h2 className="font-display text-xl gold-text">
                    Move to {ORDER_STATUS_LABELS[transitionTarget]}
                  </h2>
                </div>
                <button
                  onClick={() => setTransitionTarget(null)}
                  className="rounded-lg border border-white/10 p-1.5 text-foreground/50 hover:bg-white/5 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-3 text-sm text-foreground/60">
                A reason is required for this transition. The Master will see
                this comment when they pick the rework up.
              </p>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What needs to be redone or improved?"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setTransitionTarget(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => applyTransition(transitionTarget)}
                  loading={transitioning}
                  disabled={!reason.trim()}
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'gold' | 'default';
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <p
        className={cn(
          'font-display text-xl tabular-nums',
          tone === 'gold' && 'text-gold-300',
        )}
      >
        {value}
      </p>
    </div>
  );
}
