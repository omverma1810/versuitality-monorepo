'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Plus, Receipt, Search, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StatusBadge } from '@/components/orders/status-badge';
import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useOrderBoardSocket } from '@/hooks/useOrderBoardSocket';
import { listOrders, getOrderStats } from '@/lib/orders';
import type { OrderBoardEvent } from '@/lib/socket';
import { cn } from '@/lib/utils';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderListItem,
  type OrderStats,
  type OrderStatus,
} from '@versuitality/types';

interface ToastEntry {
  id: number;
  text: string;
  tone: 'created' | 'changed';
}

let toastId = 0;

export default function OrdersPage() {
  const { ready } = useAuthGate({
    roles: ['admin', 'staff', 'master', 'qa', 'accountant'],
  });

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const filtersRef = useRef({ statusFilter, q });
  filtersRef.current = { statusFilter, q };

  function recomputeStats(list: OrderListItem[]): OrderStats {
    const byStatus = new Map<OrderStatus, number>();
    ORDER_STATUSES.forEach((s) => byStatus.set(s, 0));
    let active = 0;
    let deliveredToday = 0;
    let last7 = 0;
    const now = Date.now();
    for (const o of list) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
      if (o.status !== 'delivered') active += 1;
      if (
        o.status === 'delivered' &&
        o.delivered_at &&
        new Date(o.delivered_at).toDateString() === new Date().toDateString()
      ) {
        deliveredToday += 1;
      }
      if (now - new Date(o.created_at).getTime() <= 7 * 24 * 3600 * 1000) {
        last7 += 1;
      }
    }
    return {
      total: list.length,
      active,
      delivered_today: deliveredToday,
      created_last_7_days: last7,
      by_status: ORDER_STATUSES.map((s) => ({ status: s, count: byStatus.get(s) ?? 0 })),
    };
  }

  function pushToast(text: string, tone: ToastEntry['tone']) {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }

  function pulseCard(orderId: string) {
    setPulses((prev) => ({ ...prev, [orderId]: Date.now() }));
    setTimeout(() => {
      setPulses((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }, 2200);
  }

  const handleEvent = useCallback((event: OrderBoardEvent) => {
    if (event.kind === 'hello') return;

    const { statusFilter: sf, q: query } = filtersRef.current;
    const matchesFilters = (o: OrderListItem) => {
      if (sf !== 'all' && o.status !== sf) return false;
      if (query.trim()) {
        const needle = query.toLowerCase();
        const digits = needle.replace(/\D+/g, '');
        const inText =
          o.order_id.toLowerCase().includes(needle) ||
          o.client.full_name.toLowerCase().includes(needle);
        const inMobile = digits ? o.client.mobile.includes(digits) : false;
        if (!inText && !inMobile) return false;
      }
      return true;
    };

    setOrders((prev) => {
      let next = prev;
      if (event.kind === 'order_created') {
        if (!matchesFilters(event.order)) return prev;
        if (prev.some((o) => o.id === event.order.id)) return prev;
        next = [event.order, ...prev];
      } else if (
        event.kind === 'order_status_changed' ||
        event.kind === 'order_updated'
      ) {
        const updated = event.order;
        const stays = matchesFilters(updated);
        const exists = prev.some((o) => o.id === updated.id);
        if (!exists && stays) next = [updated, ...prev];
        else if (exists && stays) next = prev.map((o) => (o.id === updated.id ? updated : o));
        else if (exists && !stays) next = prev.filter((o) => o.id !== updated.id);
        else return prev;
      }
      // Recompute stats whenever we changed list state — keeps tile counts live.
      setStats(recomputeStats(next));
      return next;
    });

    if (event.kind === 'order_created') {
      pulseCard(event.order.id);
      pushToast(
        `New order · ${event.order.order_id} · ${event.order.client.full_name}`,
        'created',
      );
    } else if (event.kind === 'order_status_changed') {
      pulseCard(event.order.id);
      pushToast(
        `${event.order.order_id} → ${ORDER_STATUS_LABELS[event.order.status]}`,
        'changed',
      );
    }
  }, []);

  useOrderBoardSocket(handleEvent);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listOrders({
        q,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
      getOrderStats(),
    ])
      .then(([list, s]) => {
        if (cancelled) return;
        setOrders(list.results);
        setStats(s);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, q, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<OrderStatus, OrderListItem[]>();
    ORDER_STATUSES.forEach((s) => map.set(s, []));
    for (const o of orders) {
      const list = map.get(o.status) ?? [];
      list.push(o);
      map.set(o.status, list);
    }
    return map;
  }, [orders]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Operations
          </p>
          <h1 className="font-display text-3xl gold-text">Orders</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Live order pipeline. Filter by status, dive into a card for the
            timeline, PDF receipt, and updates.
          </p>
        </div>
        <Link href="/orders/new">
          <Button>
            <Plus className="h-4 w-4" />
            New order
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Receipt}
          label="Total orders"
          value={stats?.total ?? 0}
          tone="gold"
        />
        <Kpi
          icon={Sparkles}
          label="Active in production"
          value={stats?.active ?? 0}
          tone="blue"
        />
        <Kpi
          icon={ArrowUpRight}
          label="Created · last 7 days"
          value={stats?.created_last_7_days ?? 0}
          tone="amber"
        />
        <Kpi
          icon={Receipt}
          label="Delivered today"
          value={stats?.delivered_today ?? 0}
          tone="emerald"
        />
      </section>

      {/* Filters */}
      <div className="space-y-3">
        <div className="glass-panel flex items-center gap-3 p-3">
          <Search className="h-4 w-4 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order ID, client name, or mobile…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label="All"
            count={stats?.total}
          />
          {stats?.by_status.map((b) => (
            <FilterChip
              key={b.status}
              active={statusFilter === b.status}
              onClick={() => setStatusFilter(b.status)}
              label={ORDER_STATUS_LABELS[b.status]}
              count={b.count}
            />
          ))}
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
      ) : orders.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
          <Receipt className="h-10 w-10 text-foreground/30" />
          <p className="font-display text-xl">No orders yet</p>
          <p className="max-w-md text-sm text-foreground/50">
            Once you create your first order it will appear here. Each card is
            a live entry — status changes will reflect in real time once
            Phase 4 ships.
          </p>
          <Link href="/orders/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create the first order
            </Button>
          </Link>
        </div>
      ) : statusFilter === 'all' ? (
        <KanbanBoard groups={grouped} pulses={pulses} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o, i) => (
            <OrderCard
              key={o.id}
              order={o}
              delay={i * 0.02}
              pulse={!!pulses[o.id]}
            />
          ))}
        </ul>
      )}

      {/* Live event toasts */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 30, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'glass-panel pointer-events-auto flex items-center gap-2 px-3 py-2 text-xs',
                t.tone === 'created'
                  ? 'border-gold-500/40 text-gold-100'
                  : 'border-status-production/40 text-blue-100',
              )}
            >
              <Zap
                className={cn(
                  'h-3.5 w-3.5',
                  t.tone === 'created' ? 'text-gold-300' : 'text-blue-300',
                )}
              />
              <span className="flex-1">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function KanbanBoard({
  groups,
  pulses,
}: {
  groups: Map<OrderStatus, OrderListItem[]>;
  pulses: Record<string, number>;
}) {
  const visible = ORDER_STATUSES.filter((s) => (groups.get(s) ?? []).length > 0);
  if (visible.length === 0) {
    return (
      <div className="text-sm text-foreground/40">No matching orders.</div>
    );
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {visible.map((status) => {
        const items = groups.get(status) ?? [];
        return (
          <section
            key={status}
            className="flex w-72 shrink-0 flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <StatusBadge status={status} size="md" />
              <span className="text-xs text-foreground/40">{items.length}</span>
            </div>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((o, i) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    delay={i * 0.02}
                    compact
                    pulse={!!pulses[o.id]}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  delay = 0,
  compact = false,
  pulse = false,
}: {
  order: OrderListItem;
  delay?: number;
  compact?: boolean;
  pulse?: boolean;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Link
        href={`/orders/${order.id}`}
        className={cn(
          'glass-panel group flex h-full flex-col gap-3 p-4 transition-all hover:border-gold-500/30 hover:bg-white/[0.04]',
          pulse && 'ring-2 ring-gold-500/60 ring-offset-2 ring-offset-navy-700',
        )}
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
          {!compact && <StatusBadge status={order.status} />}
        </div>
        {order.garment_summary && (
          <p className="truncate text-xs text-foreground/60">
            {order.garment_summary}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-foreground/50">
          <span>
            {(order.days_since_creation ?? 0) === 0
              ? 'Today'
              : `${order.days_since_creation}d ago`}
          </span>
          <span className="font-mono tabular-nums text-foreground/70">
            ₹ {Number(order.subtotal).toLocaleString()}
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

const KPI_TONE: Record<string, string> = {
  gold: 'text-gold-300',
  blue: 'text-blue-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
};

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof KPI_TONE;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 p-4">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/5',
          KPI_TONE[tone],
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
          : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px]',
            active ? 'bg-gold-500/30 text-gold-100' : 'bg-white/10 text-foreground/60',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
