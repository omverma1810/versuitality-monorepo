'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  History,
  IndianRupee,
  Minus,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { adjustFabric, fabricUsage, getFabric } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import {
  FABRIC_PATTERN_LABELS,
  USAGE_KIND_LABELS,
  type Fabric,
  type FabricPattern,
  type FabricUsageEntry,
  type UsageKind,
} from '@versuitality/types';

export default function FabricDetailPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff', 'master'] });
  const params = useParams<{ id: string }>();
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [usage, setUsage] = useState<FabricUsageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Adjust modal-ish inline form
  const [delta, setDelta] = useState('');
  const [kind, setKind] = useState<UsageKind>('restock');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    if (!params.id) return;
    const [f, u] = await Promise.all([
      getFabric(params.id as string),
      fabricUsage(params.id as string),
    ]);
    setFabric(f);
    setUsage(u);
  }

  useEffect(() => {
    if (!ready) return;
    reload().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, params.id]);

  if (!ready || !fabric) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
      </div>
    );
  }

  async function applyAdjust(direction: 'in' | 'out') {
    setError(null);
    const raw = parseFloat(delta || '0');
    if (!raw || raw <= 0) {
      setError('Enter a positive number of metres.');
      return;
    }
    setSubmitting(true);
    try {
      await adjustFabric(fabric!.id, {
        delta_meters: direction === 'in' ? raw : -raw,
        kind: direction === 'in' ? 'restock' : kind === 'restock' ? 'wastage' : kind,
        notes,
      });
      setDelta('');
      setNotes('');
      setKind('restock');
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Adjustment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
          Fabric
        </p>
      </div>

      <section className="glass-panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-gold-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-gold-300/80">
              {fabric.code}
            </p>
            <h1 className="mt-1 font-display text-3xl gold-text">{fabric.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
              {fabric.supplier && <span>{fabric.supplier}</span>}
              {fabric.color && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
                  {fabric.color}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
                {FABRIC_PATTERN_LABELS[fabric.pattern as FabricPattern]}
              </span>
              {fabric.fabric_type && <span>{fabric.fabric_type}</span>}
            </div>
          </div>
          {fabric.is_low_stock && (
            <span className="inline-flex items-center gap-1 self-start rounded-full border border-status-rejected/40 bg-status-rejected/15 px-3 py-1 text-xs uppercase tracking-wider text-red-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Low stock
            </span>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KV
            label="In stock"
            value={`${Number(fabric.quantity_meters).toFixed(2)} m`}
            tone={fabric.is_low_stock ? 'warn' : 'gold'}
          />
          <KV label="Threshold" value={`${Number(fabric.low_stock_threshold).toFixed(1)} m`} />
          <KV
            label="Cost / m"
            value={`₹ ${Number(fabric.cost_per_meter).toLocaleString()}`}
          />
          <KV
            label="Stock value"
            value={`₹ ${Number(fabric.stock_value).toLocaleString()}`}
          />
        </div>
      </section>

      {/* Adjust */}
      <section className="glass-panel p-6">
        <div className="mb-3 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Stock movement</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-foreground/40">
              Metres
            </span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-foreground/30"
              placeholder="0.0"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as UsageKind)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60"
          >
            {(['restock', 'wastage', 'sample', 'adjustment'] as UsageKind[]).map(
              (k) => (
                <option key={k} value={k} className="bg-navy-700">
                  {USAGE_KIND_LABELS[k]}
                </option>
              ),
            )}
          </select>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => applyAdjust('in')}
              loading={submitting}
            >
              <Plus className="h-4 w-4" />
              Stock in
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => applyAdjust('out')}
              loading={submitting}
            >
              <Minus className="h-4 w-4" />
              Stock out
            </Button>
          </div>
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note (PO number, master's reason, etc.)"
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
        />
        {error && (
          <p className="mt-2 rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}
      </section>

      {/* Usage history */}
      <section className="glass-panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Movement ledger</h2>
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-foreground/50">No movements recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {usage.map((u, i) => (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-xs',
                  Number(u.delta_meters) > 0
                    ? 'border-status-ready/30 bg-status-ready/5'
                    : 'border-status-rejected/30 bg-status-rejected/5',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    Number(u.delta_meters) > 0
                      ? 'bg-status-ready/15 text-emerald-200'
                      : 'bg-status-rejected/15 text-red-200',
                  )}
                >
                  {Number(u.delta_meters) > 0 ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {Number(u.delta_meters) > 0 ? '+' : ''}
                    {Number(u.delta_meters).toFixed(2)} m ·{' '}
                    {USAGE_KIND_LABELS[u.kind]}
                  </p>
                  <p className="text-foreground/60">
                    {u.order_code && (
                      <Link
                        href={`/orders/${u.order}`}
                        className="text-gold-300 hover:underline"
                      >
                        {u.order_code}
                      </Link>
                    )}
                    {u.order_code && u.notes && ' · '}
                    {u.notes}
                  </p>
                </div>
                <p className="text-right font-mono text-[10px] text-foreground/50">
                  {new Date(u.created_at).toLocaleString()}
                  <br />
                  {u.actor_name}
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
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
  tone?: 'gold' | 'warn';
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
          tone === 'warn' && 'text-red-200',
        )}
      >
        {value}
      </p>
    </div>
  );
}
