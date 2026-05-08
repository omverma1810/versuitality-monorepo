'use client';

import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  IndianRupee,
  Phone,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BarRow } from '@/components/analytics/bar-row';
import { Donut, type DonutSlice } from '@/components/analytics/donut';
import { Sparkline } from '@/components/analytics/sparkline';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useOrderBoardSocket } from '@/hooks/useOrderBoardSocket';
import { downloadOrdersXlsx, fetchAnalyticsSummary } from '@/lib/analytics';
import type { OrderBoardEvent } from '@/lib/socket';
import { cn } from '@/lib/utils';
import {
  GARMENT_LABELS,
  ORDER_STATUS_LABELS,
  type AnalyticsSummary,
  type GarmentType,
} from '@versuitality/types';

// Brand-aligned palette for donut slices, ordered to match the production flow.
const STATUS_PALETTE: Record<string, string> = {
  order_received: '#7160AA',
  requirements_noted: '#9C90C5',
  cutting_started: '#3B82F6',
  stitching_in_progress: '#5B8DEF',
  ready_for_trial: '#F59E0B',
  alteration_in_progress: '#FBBF24',
  ready_for_qc: '#CBA624',
  qc_rejected: '#EF4444',
  ready_for_delivery: '#10B981',
  delivered: '#059669',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'accountant'] });
  const [from, setFrom] = useState(isoMonthStart());
  const [to, setTo] = useState(todayIso());
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchAnalyticsSummary({ from, to })
      .then(setSummary)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // Live: refresh whenever an order event lands. Debounced via the inline
  // setTimeout below so a burst of events triggers one refetch.
  const [tick, setTick] = useState(0);
  useOrderBoardSocket(
    useCallback((e: OrderBoardEvent) => {
      if (e.kind === 'hello') return;
      setTick((n) => n + 1);
    }, []),
  );
  useEffect(() => {
    if (!tick) return;
    const id = setTimeout(refresh, 600);
    return () => clearTimeout(id);
  }, [tick, refresh]);

  const donutSlices: DonutSlice[] = useMemo(() => {
    if (!summary) return [];
    return summary.status_distribution
      .filter((b) => b.count > 0)
      .map((b) => ({
        key: b.status,
        label: ORDER_STATUS_LABELS[b.status],
        value: b.count,
        color: STATUS_PALETTE[b.status] ?? '#7160AA',
      }));
  }, [summary]);

  const garmentMax = useMemo(
    () =>
      summary?.garment_breakdown.reduce(
        (acc, g) => Math.max(acc, g.count),
        0,
      ) ?? 0,
    [summary],
  );

  const funnelMax = useMemo(
    () =>
      summary?.stage_funnel.reduce(
        (acc, s) => Math.max(acc, s.avg_days ?? 0),
        0,
      ) ?? 0,
    [summary],
  );

  const trendPoints = useMemo(
    () =>
      (summary?.revenue_trend ?? []).map((p) => ({
        date: p.date,
        value: p.revenue,
      })),
    [summary],
  );

  if (!ready) return null;

  async function onExport() {
    setExporting(true);
    try {
      await downloadOrdersXlsx({ from, to });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Administration
          </p>
          <h1 className="font-display text-3xl gold-text">Analytics</h1>
          <p className="mt-1 text-sm text-foreground/60">
            How the workshop is moving — orders, revenue, production stages,
            quality, and the clients who keep coming back.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          <Button onClick={onExport} loading={exporting} variant="secondary">
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
        </div>
      ) : summary ? (
        <>
          {/* Headline KPI strip */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MoMTile
              label="Orders this month"
              current={summary.mom.current.count}
              previous={summary.mom.previous.count}
              icon={Sparkles}
              tone="gold"
              format={(n) => n.toString()}
            />
            <MoMTile
              label="Revenue this month"
              current={summary.mom.current.revenue}
              previous={summary.mom.previous.revenue}
              icon={IndianRupee}
              tone="emerald"
              format={(n) => `₹ ${Math.round(n).toLocaleString()}`}
            />
            <KpiTile
              label="Active orders"
              value={summary.kpis.active_orders}
              icon={TrendingUp}
              tone="blue"
            />
            <KpiTile
              label="Active clients"
              value={summary.kpis.active_clients}
              icon={Users}
              tone="amber"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {/* Revenue trend */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5 lg:col-span-2"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gold-400" />
                  <h2 className="font-display text-lg">Revenue trend</h2>
                </div>
                <p className="text-xs text-foreground/50">
                  {summary.range.from} → {summary.range.to}
                </p>
              </div>
              <Sparkline data={trendPoints} height={120} />
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Mini
                  label="Total revenue (range)"
                  value={`₹ ${Math.round(
                    trendPoints.reduce((acc, p) => acc + p.value, 0),
                  ).toLocaleString()}`}
                />
                <Mini
                  label="Peak day"
                  value={(() => {
                    const peak = trendPoints.reduce(
                      (best, p) => (p.value > best.value ? p : best),
                      { date: '—', value: 0 },
                    );
                    return peak.value
                      ? `${peak.date} · ₹ ${Math.round(
                          peak.value,
                        ).toLocaleString()}`
                      : '—';
                  })()}
                />
              </div>
            </motion.div>

            {/* QC rejection rate */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel flex flex-col p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Quality outcomes</h2>
              </div>
              <QcGauge
                rate={summary.qc_stats.rate}
                total={summary.qc_stats.total}
                failed={summary.qc_stats.failed}
              />
            </motion.div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {/* Status distribution */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Orders by status</h2>
              </div>
              {donutSlices.length === 0 ? (
                <p className="py-12 text-center text-sm text-foreground/40">
                  No orders in this range yet.
                </p>
              ) : (
                <Donut
                  data={donutSlices}
                  centerLabel="Orders"
                  centerValue={donutSlices.reduce((a, s) => a + s.value, 0)}
                />
              )}
            </motion.div>

            {/* Garment breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Garment mix</h2>
              </div>
              {summary.garment_breakdown.length === 0 ? (
                <p className="py-12 text-center text-sm text-foreground/40">
                  No garments produced in this range.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.garment_breakdown.map((g) => (
                    <BarRow
                      key={g.garment_type}
                      label={
                        GARMENT_LABELS[g.garment_type as GarmentType] ??
                        g.garment_type
                      }
                      value={g.count}
                      max={garmentMax}
                      rightLabel={`${g.count} · ₹ ${Math.round(
                        g.revenue,
                      ).toLocaleString()}`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {/* Stage funnel */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Average days per stage</h2>
              </div>
              {funnelMax === 0 ? (
                <p className="py-12 text-center text-sm text-foreground/40">
                  Not enough timeline data yet — keep moving orders forward.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.stage_funnel.map((s) => (
                    <BarRow
                      key={s.status}
                      label={ORDER_STATUS_LABELS[s.status]}
                      value={s.avg_days ?? 0}
                      max={funnelMax}
                      rightLabel={
                        s.avg_days != null
                          ? `${s.avg_days.toFixed(1)} d · n=${s.samples}`
                          : 'no data'
                      }
                    />
                  ))}
                </div>
              )}
            </motion.div>

            {/* Top clients */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-lg">Top clients</h2>
              </div>
              {summary.top_clients.length === 0 ? (
                <p className="py-12 text-center text-sm text-foreground/40">
                  No client orders in this range.
                </p>
              ) : (
                <ul className="space-y-2">
                  {summary.top_clients.map((c, i) => (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-gold-500/30 hover:bg-white/[0.05]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-[11px] font-semibold text-gold-200">
                          {i + 1}
                        </span>
                        <Avatar name={c.full_name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {c.full_name}
                          </p>
                          <p className="flex items-center gap-2 truncate text-[11px] text-foreground/50">
                            <span className="font-mono text-gold-300/70">
                              {c.client_id}
                            </span>
                            <Phone className="h-3 w-3" />
                            {c.mobile}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-mono tabular-nums text-foreground/80">
                            {c.order_count} orders
                          </p>
                          <p className="text-foreground/50">
                            ₹ {Math.round(c.total_value).toLocaleString()}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-gold-500/60"
      />
    </label>
  );
}

const TONE_CLASS: Record<string, string> = {
  gold: 'text-gold-300',
  emerald: 'text-emerald-300',
  blue: 'text-blue-300',
  amber: 'text-amber-300',
};

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 p-4">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/5',
          TONE_CLASS[tone],
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

function MoMTile({
  label,
  current,
  previous,
  icon: Icon,
  tone,
  format,
}: {
  label: string;
  current: number;
  previous: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASS;
  format: (n: number) => string;
}) {
  const delta = current - previous;
  const pct = previous ? (delta / previous) * 100 : current ? 100 : 0;
  const up = delta >= 0;
  return (
    <div className="glass-panel flex items-center gap-4 p-4">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/5',
          TONE_CLASS[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-foreground/40">
          {label}
        </p>
        <p className="font-display text-2xl tabular-nums">{format(current)}</p>
        <p
          className={cn(
            'mt-0.5 inline-flex items-center gap-1 text-[11px]',
            up ? 'text-emerald-300' : 'text-red-300',
          )}
        >
          {up ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {up ? '+' : ''}
          {pct.toFixed(1)}% vs last month
        </p>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <p className="mt-0.5 font-mono tabular-nums text-foreground/80">{value}</p>
    </div>
  );
}

/** Simple semi-circular gauge — green when low, red when high. */
function QcGauge({
  rate,
  total,
  failed,
}: {
  rate: number;
  total: number;
  failed: number;
}) {
  const pct = Math.min(1, Math.max(0, rate));
  // Colour the gauge based on the rate — green ≤ 5%, gold ≤ 15%, red beyond.
  const color = pct <= 0.05 ? '#10B981' : pct <= 0.15 ? '#CBA624' : '#EF4444';
  const label =
    pct <= 0.05 ? 'Excellent' : pct <= 0.15 ? 'Acceptable' : 'Needs attention';

  const size = 180;
  const cx = size / 2;
  const cy = size * 0.7;
  const r = size * 0.45;
  const C = Math.PI * r;
  const filled = pct * C;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <svg
        width={size}
        height={size * 0.78}
        viewBox={`0 0 ${size} ${size * 0.78}`}
      >
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C}`}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="font-display"
          fill={color}
          style={{ fontSize: 28, fontWeight: 600 }}
        >
          {(pct * 100).toFixed(1)}%
        </text>
      </svg>
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color }}>
        {label}
      </p>
      <div className="flex w-full items-center justify-around text-xs">
        <Stat label="Inspections" value={total.toString()} icon={CheckCircle2} />
        <Stat
          label="Rejections"
          value={failed.toString()}
          icon={ShieldAlert}
          tone="rejected"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'rejected';
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          tone === 'rejected' ? 'text-red-300' : 'text-gold-300',
        )}
      />
      <span className="font-mono text-base tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </span>
    </div>
  );
}
