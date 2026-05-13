'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Phone,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { getOrder } from '@/lib/orders';
import {
  fetchChecklistItems,
  fetchInspections,
  submitInspection,
} from '@/lib/qa';
import { cn } from '@/lib/utils';
import type {
  Order,
  QcChecklistItemDef,
  QcChecklistResponse,
  QcInspection,
  QcOutcome,
  QcResult,
} from '@versuitality/types';

type Responses = Record<string, QcChecklistResponse | undefined>;

export default function InspectionPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'qa'] });
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<QcChecklistItemDef[]>([]);
  const [history, setHistory] = useState<QcInspection[]>([]);
  const [responses, setResponses] = useState<Responses>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<QcOutcome | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([
      getOrder(orderId),
      fetchChecklistItems(),
      fetchInspections(orderId),
    ])
      .then(([o, list, hist]) => {
        if (cancelled) return;
        setOrder(o);
        setItems(list);
        setHistory(hist.results);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ready, orderId]);

  const allAnswered = useMemo(
    () => items.length > 0 && items.every((i) => responses[i.key]?.result),
    [items, responses],
  );
  const anyFailed = useMemo(
    () => items.some((i) => responses[i.key]?.result === 'fail'),
    [items, responses],
  );

  if (!ready) return null;
  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
      </div>
    );
  }

  if (order.status !== 'ready_for_qc') {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-400" />
        <p className="font-display text-xl">This order isn&apos;t in QC right now</p>
        <p className="max-w-md text-sm text-foreground/50">
          Inspections can only be recorded against orders the master has
          marked as ready for quality check. Current status:
          <span className="ml-1 font-medium text-foreground">{order.status}</span>.
        </p>
        <div className="flex gap-2">
          <Link href="/qa">
            <Button variant="secondary">Back to queue</Button>
          </Link>
          <Link href={`/orders/${order.id}`}>
            <Button>View order</Button>
          </Link>
        </div>
      </div>
    );
  }

  function setResult(key: string, result: QcResult) {
    setResponses((prev) => ({
      ...prev,
      [key]: { result, note: prev[key]?.note ?? '' },
    }));
  }

  function setNote(key: string, note: string) {
    setResponses((prev) => ({
      ...prev,
      [key]: { result: prev[key]?.result ?? 'pass', note },
    }));
  }

  async function handleSubmit(outcome: QcOutcome) {
    setError(null);
    if (!allAnswered) {
      setError('Answer every checklist item before submitting.');
      return;
    }
    if (outcome === 'pass' && anyFailed) {
      setError('Cannot pass while any checklist item is marked as fail.');
      return;
    }
    if (outcome === 'fail' && !anyFailed) {
      setError('A fail outcome needs at least one checklist item marked fail.');
      return;
    }
    if (outcome === 'fail' && !comment.trim() && !items.some((i) => responses[i.key]?.note)) {
      setError(
        'Add an overall comment or per-item notes so the master has context for rework.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const checklist = Object.fromEntries(
        items.map((i) => [
          i.key,
          {
            result: responses[i.key]!.result,
            note: responses[i.key]!.note ?? '',
          },
        ]),
      );
      await submitInspection({
        order: orderId,
        outcome,
        overall_comment: comment,
        checklist,
      });
      router.replace(`/orders/${orderId}?welcome=1`);
    } catch (e) {
      if (e instanceof ApiError) {
        const data = e.data as Record<string, unknown> | null;
        if (data && typeof data === 'object') {
          const flat = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
            .join(' · ');
          setError(flat || e.message);
        } else {
          setError(e.message);
        }
      } else {
        setError('Could not submit the inspection.');
      }
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/qa"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
          QC inspection
        </p>
      </div>

      {/* Order summary */}
      <section className="glass-panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-gold-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-gold-300/80">
              {order.order_id}
            </p>
            <h1 className="mt-1 font-display text-2xl gold-text">
              {order.client.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.client.mobile}
              </span>
              {order.garment_summary && (
                <span className="flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  {order.garment_summary}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/orders/${order.id}`}
            className="text-xs text-gold-300 hover:underline"
          >
            View full order →
          </Link>
        </div>
      </section>

      {/* Previous inspections */}
      {history.length > 0 && <PreviousInspections items={items} history={history} />}

      {/* Checklist */}
      <section className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Quality checklist</h2>
        </div>
        <p className="mb-5 text-xs text-foreground/50">
          Mark every item as Pass or Fail. Add a note where it helps the
          master understand what to fix.
        </p>
        <ul className="space-y-3">
          {items.map((item) => {
            const r = responses[item.key];
            return (
              <li
                key={item.key}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  r?.result === 'fail'
                    ? 'border-status-rejected/40 bg-status-rejected/[0.06]'
                    : r?.result === 'pass'
                      ? 'border-status-ready/40 bg-status-ready/[0.04]'
                      : 'border-white/10 bg-white/[0.02]',
                )}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-0.5 text-xs text-foreground/50">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setResult(item.key, 'pass')}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                        r?.result === 'pass'
                          ? 'border-status-ready/60 bg-status-ready/15 text-emerald-200'
                          : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-status-ready/40 hover:text-emerald-100',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult(item.key, 'fail')}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                        r?.result === 'fail'
                          ? 'border-status-rejected/60 bg-status-rejected/15 text-red-200'
                          : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-status-rejected/40 hover:text-red-200',
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                      Fail
                    </button>
                  </div>
                </div>
                {(r?.result === 'fail' || (r?.note ?? '').length > 0) && (
                  <textarea
                    rows={2}
                    placeholder={
                      r?.result === 'fail'
                        ? 'Describe what needs to be redone'
                        : 'Optional note'
                    }
                    value={r?.note ?? ''}
                    onChange={(e) => setNote(item.key, e.target.value)}
                    className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
                  />
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
            Overall comment
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional on pass · required on fail (helps the master start rework)"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="danger"
            onClick={() => setConfirm('fail')}
            disabled={!allAnswered || !anyFailed}
          >
            <ShieldAlert className="h-4 w-4" />
            Reject — start rework
          </Button>
          <Button
            onClick={() => setConfirm('pass')}
            disabled={!allAnswered || anyFailed}
          >
            <ShieldCheck className="h-4 w-4" />
            Pass — ready for delivery
          </Button>
        </div>
      </section>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            outcome={confirm}
            onClose={() => setConfirm(null)}
            onConfirm={() => handleSubmit(confirm)}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviousInspections({
  items,
  history,
}: {
  items: QcChecklistItemDef[];
  history: QcInspection[];
}) {
  const labelOf = (key: string) =>
    items.find((i) => i.key === key)?.label ?? key;
  return (
    <section className="glass-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-gold-400" />
        <h2 className="font-display text-lg">Prior inspections</h2>
      </div>
      <ul className="space-y-2">
        {history.map((h) => (
          <li
            key={h.id}
            className={cn(
              'rounded-xl border p-3 text-xs',
              h.outcome === 'pass'
                ? 'border-status-ready/30 bg-status-ready/5'
                : 'border-status-rejected/30 bg-status-rejected/5',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  h.outcome === 'pass'
                    ? 'border-status-ready/40 bg-status-ready/15 text-emerald-200'
                    : 'border-status-rejected/40 bg-status-rejected/15 text-red-200',
                )}
              >
                {h.outcome === 'pass' ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <ShieldAlert className="h-3 w-3" />
                )}
                {h.outcome.toUpperCase()}
              </span>
              <span className="text-foreground/50">
                {new Date(h.created_at).toLocaleString()} · {h.inspector_name}
              </span>
            </div>
            {h.outcome === 'fail' && h.failed_items.length > 0 && (
              <p className="mt-2 text-foreground/70">
                Failed: {h.failed_items.map(labelOf).join(', ')}
              </p>
            )}
            {h.overall_comment && (
              <p className="mt-1 text-foreground/60">&ldquo;{h.overall_comment}&rdquo;</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfirmModal({
  outcome,
  submitting,
  onConfirm,
  onClose,
}: {
  outcome: QcOutcome;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isPass = outcome === 'pass';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !submitting && onClose()}
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
        <div className="mb-3 flex items-center gap-2">
          {isPass ? (
            <ShieldCheck className="h-5 w-5 text-status-ready" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-status-rejected" />
          )}
          <h2 className="font-display text-xl">
            {isPass ? 'Pass this inspection?' : 'Reject and start rework?'}
          </h2>
        </div>
        <p className="text-sm text-foreground/60">
          {isPass ? (
            <>
              The order will move to &ldquo;Ready for delivery&rdquo; and the
              client will be notified once messaging ships in Phase 6.
            </>
          ) : (
            <>
              The order will move back to &ldquo;QC rejected&rdquo; so the master
              can address the failed items. Your comment is preserved on the
              timeline.
            </>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={isPass ? 'primary' : 'danger'}
            onClick={onConfirm}
            loading={submitting}
          >
            {isPass ? 'Confirm pass' : 'Confirm reject'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
