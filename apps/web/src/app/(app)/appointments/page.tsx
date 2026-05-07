'use client';

import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { listAppointments, transitionAppointment } from '@/lib/appointments';
import { cn } from '@/lib/utils';
import {
  APPOINTMENT_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentKind,
  type AppointmentStatus,
} from '@versuitality/types';

export default function AppointmentsPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'all' | 'completed' | 'cancelled'>(
    'upcoming',
  );

  function refresh() {
    setLoading(true);
    listAppointments({})
      .then((d) => setItems(d.results))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    return items.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      if (filter === 'all') return true;
      if (filter === 'upcoming')
        return a.status === 'scheduled' && t >= now - 60 * 60 * 1000;
      if (filter === 'today')
        return t >= startOfToday.getTime() && t < endOfToday.getTime();
      if (filter === 'completed') return a.status === 'completed';
      if (filter === 'cancelled')
        return a.status === 'cancelled' || a.status === 'no_show';
      return true;
    });
  }, [items, filter]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const key = new Date(a.scheduled_at).toLocaleDateString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const arr = buckets.get(key) ?? [];
      arr.push(a);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries());
  }, [filtered]);

  if (!ready) return null;

  async function quick(id: string, status: 'completed' | 'cancelled' | 'no_show') {
    try {
      await transitionAppointment(id, status);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Operations
          </p>
          <h1 className="font-display text-3xl gold-text">Appointments</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Book measurement sessions, trial fittings, and pickups. Reminders
            fire automatically two hours before each appointment.
          </p>
        </div>
        <Link href="/appointments/new">
          <Button>
            <Plus className="h-4 w-4" />
            New appointment
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['upcoming', 'Upcoming'],
          ['today', 'Today'],
          ['all', 'All'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled / No-show'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              filter === k
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
            )}
          >
            {label}
          </button>
        ))}
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
      ) : filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
          <CalendarDays className="h-10 w-10 text-foreground/30" />
          <p className="font-display text-xl">Nothing scheduled here</p>
          <p className="max-w-md text-sm text-foreground/50">
            Book an appointment for a walk-in or returning client. Reminders
            and confirmations land via email + WhatsApp automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, list]) => (
            <section key={day} className="space-y-2">
              <p className="px-1 text-xs font-medium uppercase tracking-[0.2em] text-foreground/40">
                {day}
              </p>
              <ul className="space-y-2">
                {list.map((a, i) => (
                  <Card
                    key={a.id}
                    a={a}
                    i={i}
                    onQuick={(status) => quick(a.id, status)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<AppointmentStatus, string> = {
  scheduled: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  completed: 'border-status-ready/40 bg-status-ready/10 text-emerald-200',
  cancelled: 'border-foreground/20 bg-white/5 text-foreground/60',
  no_show: 'border-status-rejected/40 bg-status-rejected/10 text-red-200',
};

const KIND_TONE: Record<AppointmentKind, string> = {
  measurement: 'text-gold-300',
  trial: 'text-amber-300',
  consultation: 'text-blue-300',
  delivery: 'text-emerald-300',
  other: 'text-foreground/60',
};

function Card({
  a,
  i,
  onQuick,
}: {
  a: Appointment;
  i: number;
  onQuick: (status: 'completed' | 'cancelled' | 'no_show') => void;
}) {
  const when = new Date(a.scheduled_at);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.02 }}
      className="glass-panel flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4"
    >
      <div className="flex shrink-0 items-center gap-3 md:w-44">
        <span
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-white/5',
            KIND_TONE[a.kind],
          )}
        >
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-lg leading-tight tabular-nums">
            {when.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-foreground/40">
            {APPOINTMENT_KIND_LABELS[a.kind]}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {a.full_name}
          {a.client_code && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
              {a.client_code}
            </span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-foreground/50">
          {a.mobile && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {a.mobile}
            </span>
          )}
          <span>{a.duration_minutes} min</span>
          {a.reminder_sent_at && (
            <span className="text-emerald-300">Reminder sent</span>
          )}
        </div>
        {a.notes && (
          <p className="mt-1 truncate text-xs text-foreground/60">{a.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
            STATUS_TONE[a.status],
          )}
        >
          {APPOINTMENT_STATUS_LABELS[a.status]}
        </span>
        {a.status === 'scheduled' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onQuick('completed')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-status-ready/30 bg-status-ready/10 text-emerald-200 hover:bg-status-ready/20"
              title="Mark completed"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onQuick('cancelled')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-status-rejected/30 bg-status-rejected/10 text-red-200 hover:bg-status-rejected/20"
              title="Cancel"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.li>
  );
}
