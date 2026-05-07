'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import {
  NOTIFICATION_TEMPLATE_LABELS,
  type NotificationLogEntry,
} from '@versuitality/types';

interface Props {
  entries: NotificationLogEntry[];
}

export function NotificationLog({ entries }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <section className="glass-panel p-5">
        <div className="mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Notifications</h2>
        </div>
        <p className="text-xs text-foreground/50">
          No notifications dispatched yet for this order. Email and WhatsApp
          messages fire automatically on every client-facing status change.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Notifications</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/50">
          {entries.length} dispatched
        </span>
      </div>

      <ul className="space-y-2">
        {entries.map((n, i) => {
          const isOpen = expanded === n.id;
          const Icon = n.channel === 'email' ? Mail : MessageCircle;
          const tone =
            n.status === 'sent'
              ? 'border-status-ready/30 bg-status-ready/5'
              : n.status === 'failed'
                ? 'border-status-rejected/30 bg-status-rejected/5'
                : 'border-white/10 bg-white/[0.02]';
          return (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn('rounded-xl border p-3 text-xs', tone)}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : n.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    n.channel === 'email'
                      ? 'bg-blue-500/15 text-blue-200'
                      : 'bg-emerald-500/15 text-emerald-200',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {NOTIFICATION_TEMPLATE_LABELS[n.template_key] ??
                        n.template_key}
                    </p>
                    <StatusPill status={n.status} />
                    {n.provider.startsWith('console:') && (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-foreground/50">
                        Console (dev)
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-foreground/60">
                    {n.channel === 'email' ? 'Email' : 'WhatsApp'} →{' '}
                    <span className="font-mono text-foreground/70">{n.to_address}</span>
                  </p>
                </div>

                <p className="shrink-0 font-mono text-[10px] text-foreground/50">
                  {new Date(n.created_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <span className="mx-1 text-foreground/30">·</span>
                  {new Date(n.created_at).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
              </button>

              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2"
                >
                  {n.subject && (
                    <p className="text-foreground/70">
                      <span className="text-[10px] uppercase tracking-wider text-foreground/40">
                        Subject
                      </span>
                      <br />
                      <span className="font-medium">{n.subject}</span>
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap rounded-lg border border-white/5 bg-navy-900/40 p-3 font-sans text-foreground/75">
                    {n.body}
                  </pre>
                  {n.error && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-status-rejected/30 bg-status-rejected/10 p-2 text-red-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{n.error}</span>
                    </p>
                  )}
                  {n.provider_message_id && (
                    <p className="text-[10px] text-foreground/40">
                      Provider id ·{' '}
                      <span className="font-mono">{n.provider_message_id}</span>
                    </p>
                  )}
                </motion.div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: NotificationLogEntry['status'] }) {
  const meta: Record<NotificationLogEntry['status'], { label: string; tone: string; icon: React.ReactNode }> = {
    sent: {
      label: 'Sent',
      tone: 'border-status-ready/40 bg-status-ready/15 text-emerald-200',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      tone: 'border-status-rejected/40 bg-status-rejected/15 text-red-200',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    pending: {
      label: 'Pending',
      tone: 'border-status-trial/40 bg-status-trial/15 text-amber-200',
      icon: <Clock className="h-3 w-3" />,
    },
    skipped: {
      label: 'Skipped',
      tone: 'border-white/10 bg-white/[0.04] text-foreground/60',
      icon: <Clock className="h-3 w-3" />,
    },
  };
  const m = meta[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider',
        m.tone,
      )}
    >
      {m.icon}
      {m.label}
    </span>
  );
}
