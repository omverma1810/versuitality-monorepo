'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  Clock,
  Phone,
  Receipt,
  Scissors,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { RoleBadge } from '@/components/ui/role-badge';
import { useOrderBoardSocket } from '@/hooks/useOrderBoardSocket';
import { fetchTodayAppointments } from '@/lib/appointments';
import { listLowStock } from '@/lib/inventory';
import { getOrderStats } from '@/lib/orders';
import type { OrderBoardEvent } from '@/lib/socket';
import {
  APPOINTMENT_KIND_LABELS,
  ROLE_DESCRIPTIONS,
  type Appointment,
  type Fabric,
  type OrderStats,
  type Role,
} from '@versuitality/types';
import { useAuthStore } from '@/store/authStore';

const ROLE_NEXT_STEPS: Record<Role, string[]> = {
  admin: [
    'Invite the rest of the team from Team & roles',
    'Watch the live order board — every status change appears in real time',
    'Open Analytics for the month-on-month view, top clients, and stage funnel',
  ],
  staff: [
    'Register a new walk-in client',
    'Capture body measurements digitally and link them to a fresh order',
    'Hand the printed PDF receipt to the client',
  ],
  master: [
    'Open the production board — orders are grouped by current status',
    'Move orders forward as you progress through cutting / stitching / trial',
    'Pick up rework items flagged by QA — failed checklist items show on the order page',
  ],
  qa: [
    'Open the QC queue — only orders awaiting inspection appear there',
    'Run the structured checklist before passing or rejecting',
    'Failed inspections record per-item notes for the master to act on',
  ],
  accountant: [
    'Open Analytics for revenue trends, garment mix, and stage funnel',
    'Export the date-range orders workbook for offline review',
  ],
};

function LiveTile({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel relative flex flex-col gap-3 p-5"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
          <Icon className="h-5 w-5" />
        </span>
        {hint && (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/40">
            {hint}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-foreground/40">
          {title}
        </p>
        <p className="font-display text-3xl tabular-nums">{value}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [lowStock, setLowStock] = useState<Fabric[]>([]);

  const refresh = useCallback(() => {
    getOrderStats()
      .then(setStats)
      .catch(() => undefined);
    fetchTodayAppointments()
      .then(setTodayAppts)
      .catch(() => undefined);
    listLowStock()
      .then(setLowStock)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live: re-pull stats whenever an order event fires. The volume here is low
  // enough that a fresh fetch keeps the math correct without re-deriving on
  // the client.
  useOrderBoardSocket(
    useCallback(
      (e: OrderBoardEvent) => {
        if (e.kind === 'hello') return;
        refresh();
      },
      [refresh],
    ),
  );

  if (!user) return null;

  const firstName = user.full_name.split(' ', 1)[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel relative overflow-hidden p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <RoleBadge role={user.role} />
          </div>
          <h1 className="font-display text-4xl tracking-tight">
            <span className="text-foreground/60">{greeting},</span>{' '}
            <span className="gold-text">{firstName}.</span>
          </h1>
          <p className="max-w-2xl text-sm text-foreground/60">
            {ROLE_DESCRIPTIONS[user.role]}. Phase 1 is live — authentication and
            role-based access are wired end-to-end. Subsequent phases unlock
            CRM, orders, the live production board, QA, notifications, and
            analytics.
          </p>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LiveTile
          icon={Receipt}
          title="Active orders"
          value={stats?.active ?? 0}
          hint="In production"
        />
        <LiveTile
          icon={Sparkles}
          title="Created · last 7 days"
          value={stats?.created_last_7_days ?? 0}
        />
        <LiveTile
          icon={ShieldCheck}
          title="Pending QC"
          value={
            stats?.by_status.find((b) => b.status === 'ready_for_qc')?.count ?? 0
          }
        />
        <LiveTile
          icon={Scissors}
          title="Delivered today"
          value={stats?.delivered_today ?? 0}
        />
      </section>

      {/* Today's appointments + low stock — both hide cleanly when empty so
          the dashboard stays calm for new shops. */}
      {(todayAppts.length > 0 || lowStock.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {todayAppts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gold-400" />
                  <h2 className="font-display text-lg">Today&apos;s appointments</h2>
                </div>
                <Link
                  href="/appointments"
                  className="text-xs text-gold-300 hover:underline"
                >
                  View all →
                </Link>
              </div>
              <ul className="space-y-2">
                {todayAppts.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-sm"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-300">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-mono tabular-nums">
                          {new Date(a.scheduled_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>{' '}
                        · {a.full_name}
                      </p>
                      <p className="truncate text-xs text-foreground/50">
                        {APPOINTMENT_KIND_LABELS[a.kind]}
                        {a.mobile && (
                          <>
                            {' · '}
                            <Phone className="inline h-3 w-3" /> {a.mobile}
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {lowStock.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-300" />
                  <h2 className="font-display text-lg">Low stock</h2>
                </div>
                <Link
                  href="/inventory?low=1"
                  className="text-xs text-gold-300 hover:underline"
                >
                  View inventory →
                </Link>
              </div>
              <ul className="space-y-2">
                {lowStock.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/inventory/${f.id}`}
                      className="flex items-center gap-3 rounded-xl border border-status-rejected/20 bg-status-rejected/5 p-2.5 text-sm transition-colors hover:border-status-rejected/40"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-rejected/15 text-red-200">
                        <Boxes className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-xs text-foreground/50">
                          {f.code} · threshold{' '}
                          {Number(f.low_stock_threshold).toFixed(1)} m
                        </p>
                      </div>
                      <span className="font-mono text-sm text-red-200 tabular-nums">
                        {Number(f.quantity_meters).toFixed(1)} m
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel p-6 lg:col-span-2"
        >
          <h2 className="mb-4 font-display text-xl">What&apos;s next for you</h2>
          <ul className="space-y-3 text-sm">
            {ROLE_NEXT_STEPS[user.role].map((step) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold-400" />
                <span className="text-foreground/70">{step}</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-foreground/30" />
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="glass-panel p-6"
        >
          <h2 className="mb-4 font-display text-xl">Brand</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <dt className="text-foreground/50">Order ID</dt>
              <dd className="font-mono text-xs text-gold-300">VS-YYYYMMDD-XXXX</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <dt className="text-foreground/50">Gold</dt>
              <dd className="flex items-center gap-2 font-mono text-xs">
                <span className="h-3 w-3 rounded-full bg-gold-500 ring-1 ring-white/20" />
                #CBA624
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <dt className="text-foreground/50">Navy</dt>
              <dd className="flex items-center gap-2 font-mono text-xs">
                <span className="h-3 w-3 rounded-full bg-navy-600 ring-1 ring-white/20" />
                #261F53
              </dd>
            </div>
          </dl>
        </motion.div>
      </section>
    </div>
  );
}
