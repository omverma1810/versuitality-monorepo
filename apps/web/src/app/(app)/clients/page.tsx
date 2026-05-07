'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Phone, Plus, Ruler, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { listClients } from '@/lib/clients';
import { cn } from '@/lib/utils';
import type { Client } from '@versuitality/types';

function formatRelative(iso?: string | null) {
  if (!iso) return 'No measurements yet';
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export default function ClientsPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff', 'master'] });
  const [clients, setClients] = useState<Client[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    listClients({ q })
      .then((data) => {
        if (cancelled) return;
        setClients(data.results);
        setCount(data.count);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, q]);

  const stats = useMemo(() => {
    const totalMeasurements = clients.reduce(
      (acc, c) => acc + (c.measurement_count ?? 0),
      0,
    );
    const recent = clients.filter((c) => {
      if (!c.last_measurement_at) return false;
      return Date.now() - new Date(c.last_measurement_at).getTime() < 30 * 24 * 3600 * 1000;
    }).length;
    return { totalMeasurements, recent };
  }, [clients]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">CRM</p>
          <h1 className="font-display text-3xl gold-text">Clients</h1>
          <p className="mt-1 text-sm text-foreground/60">
            One unified profile per client — contact, preferences, measurement
            history, and orders.
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="h-4 w-4" />
            New client
          </Button>
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Users}
          label="Total clients"
          value={count}
          accent="gold-300"
        />
        <Stat
          icon={Ruler}
          label="Total measurement sets"
          value={stats.totalMeasurements}
          accent="emerald-300"
        />
        <Stat
          icon={ArrowUpRight}
          label="Visited in last 30 days"
          value={stats.recent}
          accent="blue-300"
        />
      </section>

      <div className="glass-panel flex items-center gap-3 p-3">
        <Search className="h-4 w-4 text-foreground/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile, email, or client ID…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="text-xs text-foreground/50 hover:text-foreground"
          >
            Clear
          </button>
        )}
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
      ) : clients.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
          <Users className="h-10 w-10 text-foreground/30" />
          <p className="font-display text-xl">No clients yet</p>
          <p className="max-w-md text-sm text-foreground/50">
            Start by registering your first walk-in client. Their contact
            details, preferences, and measurements will live here for every
            future visit.
          </p>
          <Link href="/clients/new">
            <Button>
              <Plus className="h-4 w-4" />
              Register the first client
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.02 * i }}
            >
              <Link
                href={`/clients/${c.id}`}
                className="glass-panel group flex h-full flex-col gap-3 p-5 transition-all hover:border-gold-500/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.full_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg leading-tight">
                      {c.full_name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
                      {c.client_id}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-foreground/30 transition-colors group-hover:text-gold-300" />
                </div>

                <div className="space-y-1.5 text-xs text-foreground/60">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-foreground/40" />
                    <span className="font-mono tabular-nums">{c.mobile}</span>
                  </div>
                  {c.email && (
                    <p className="truncate text-foreground/50">{c.email}</p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px]">
                  <span className="text-foreground/50">
                    Last visit · {formatRelative(c.last_measurement_at)}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-foreground/70">
                    {c.measurement_count ?? 0} sets
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

const ACCENT_CLASSES: Record<string, string> = {
  'gold-300': 'text-gold-300',
  'emerald-300': 'text-emerald-300',
  'blue-300': 'text-blue-300',
};

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: keyof typeof ACCENT_CLASSES;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 p-4">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/5',
          ACCENT_CLASSES[accent],
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
