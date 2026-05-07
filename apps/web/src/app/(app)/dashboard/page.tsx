'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Receipt,
  Scissors,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { RoleBadge } from '@/components/ui/role-badge';
import { ROLE_DESCRIPTIONS, type Role } from '@versuitality/types';
import { useAuthStore } from '@/store/authStore';

const ROLE_NEXT_STEPS: Record<Role, string[]> = {
  admin: [
    'Invite the rest of the team from Team & roles',
    'Review the live order board (ships in Phase 4)',
    'Open analytics for the month-on-month view (Phase 8)',
  ],
  staff: [
    'Register a new walk-in client (Phase 2)',
    'Capture body measurements digitally (Phase 2)',
    'Create the order and print the PDF receipt (Phase 3)',
  ],
  master: [
    'Open the production board (Phase 4)',
    'Update order status as you progress through cutting / stitching',
    'Pick up rework items flagged by QA (Phase 5)',
  ],
  qa: [
    'Open the QC queue — only orders ready for inspection (Phase 5)',
    'Run the structured checklist before passing or rejecting',
  ],
  accountant: [
    'View order history and revenue trends (Phase 8)',
    'Export financial reports to Excel (Phase 8)',
  ],
};

const PHASE_TILES = [
  {
    icon: Users,
    title: 'Clients',
    body: 'CRM, measurement form, history & search',
    phase: 2,
  },
  {
    icon: Receipt,
    title: 'Orders',
    body: 'Multi-step creation, PDF receipt, status timeline',
    phase: 3,
  },
  {
    icon: Scissors,
    title: 'Live board',
    body: 'Real-time kanban via Django Channels',
    phase: 4,
  },
  {
    icon: ShieldCheck,
    title: 'QA checklist',
    body: 'Structured pass/fail with rework loop',
    phase: 5,
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
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
        {PHASE_TILES.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <motion.div
              key={tile.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="glass-panel group relative flex flex-col gap-3 p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/40">
                  Phase {tile.phase}
                </span>
              </div>
              <div>
                <p className="font-display text-lg">{tile.title}</p>
                <p className="text-xs text-foreground/50">{tile.body}</p>
              </div>
            </motion.div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel p-6 lg:col-span-2"
        >
          <h2 className="mb-4 font-display text-xl">What's next for you</h2>
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
