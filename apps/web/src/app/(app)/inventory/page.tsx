'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Boxes,
  Layers,
  Plus,
  Search,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { listFabrics } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import {
  FABRIC_PATTERN_LABELS,
  type Fabric,
  type FabricPattern,
} from '@versuitality/types';

export default function InventoryPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff', 'master'] });
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    listFabrics({ q, low_stock: showLowOnly })
      .then((d) => !cancelled && setFabrics(d.results))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, q, showLowOnly]);

  const stats = useMemo(() => {
    const total = fabrics.length;
    const lowCount = fabrics.filter((f) => f.is_low_stock).length;
    const totalMeters = fabrics.reduce(
      (acc, f) => acc + Number(f.quantity_meters),
      0,
    );
    const stockValue = fabrics.reduce(
      (acc, f) => acc + Number(f.stock_value),
      0,
    );
    return { total, lowCount, totalMeters, stockValue };
  }, [fabrics]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Supply chain
          </p>
          <h1 className="font-display text-3xl gold-text">Fabric inventory</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Every bolt tracked in metres. When fabric is picked on an order,
            its stock is deducted automatically.
          </p>
        </div>
        <Link href="/inventory/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add fabric
          </Button>
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Boxes} label="Active fabrics" value={stats.total.toString()} tone="gold" />
        <Stat
          icon={Layers}
          label="Total stock"
          value={`${stats.totalMeters.toFixed(1)} m`}
          tone="blue"
        />
        <Stat
          icon={Warehouse}
          label="Stock value"
          value={`₹ ${stats.stockValue.toLocaleString()}`}
          tone="emerald"
        />
        <Stat
          icon={AlertTriangle}
          label="Low stock items"
          value={stats.lowCount.toString()}
          tone={stats.lowCount > 0 ? 'rejected' : 'gold'}
        />
      </section>

      <div className="space-y-3">
        <div className="glass-panel flex items-center gap-3 p-3">
          <Search className="h-4 w-4 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, supplier, color, code…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!showLowOnly}
            onClick={() => setShowLowOnly(false)}
            label="All"
          />
          <FilterChip
            active={showLowOnly}
            onClick={() => setShowLowOnly(true)}
            label="Low stock only"
            tone="warn"
            count={stats.lowCount || undefined}
          />
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
      ) : fabrics.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
          <Boxes className="h-10 w-10 text-foreground/30" />
          <p className="font-display text-xl">No fabrics tracked yet</p>
          <p className="max-w-md text-sm text-foreground/50">
            Add your first fabric bolt — name, supplier, colour, opening
            quantity. Subsequent edits run through a signed ledger so you&apos;ll
            always know how stock moved.
          </p>
          <Link href="/inventory/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add the first fabric
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fabrics.map((f, i) => (
            <FabricCard key={f.id} fabric={f} delay={i * 0.02} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FabricCard({ fabric, delay = 0 }: { fabric: Fabric; delay?: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link
        href={`/inventory/${fabric.id}`}
        className={cn(
          'glass-panel group flex h-full flex-col gap-3 p-5 transition-all hover:border-gold-500/40 hover:bg-white/[0.04]',
          fabric.is_low_stock && 'border-status-rejected/30',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
              {fabric.code}
            </p>
            <p className="truncate font-display text-base leading-tight">
              {fabric.name}
            </p>
            {fabric.supplier && (
              <p className="truncate text-xs text-foreground/50">
                {fabric.supplier}
              </p>
            )}
          </div>
          {fabric.is_low_stock && (
            <span className="flex items-center gap-1 rounded-full border border-status-rejected/40 bg-status-rejected/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-200">
              <AlertTriangle className="h-3 w-3" />
              Low
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/60">
          {fabric.color && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
              {fabric.color}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
            {FABRIC_PATTERN_LABELS[fabric.pattern as FabricPattern]}
          </span>
          {fabric.fabric_type && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
              {fabric.fabric_type}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/5 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/40">
              Stock
            </p>
            <p
              className={cn(
                'font-display text-2xl tabular-nums',
                fabric.is_low_stock ? 'text-red-200' : 'text-gold-300',
              )}
            >
              {Number(fabric.quantity_meters).toFixed(1)} m
            </p>
            <p className="text-[10px] text-foreground/40">
              threshold {Number(fabric.low_stock_threshold).toFixed(1)} m
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-foreground/40">
              Cost / m
            </p>
            <p className="font-mono text-sm tabular-nums text-foreground/80">
              ₹ {Number(fabric.cost_per_meter).toLocaleString()}
            </p>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

const STAT_TONE: Record<string, string> = {
  gold: 'text-gold-300',
  blue: 'text-blue-300',
  emerald: 'text-emerald-300',
  rejected: 'text-red-300',
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 p-4">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/5',
          STAT_TONE[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-foreground/40">
          {label}
        </p>
        <p className="font-display text-2xl tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: 'warn';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? tone === 'warn'
            ? 'border-status-rejected/60 bg-status-rejected/15 text-red-200'
            : 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
          : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px]',
            active ? 'bg-white/20 text-foreground' : 'bg-white/10 text-foreground/60',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
