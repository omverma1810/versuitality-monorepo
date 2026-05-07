'use client';

import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';

import { useAuthGate } from '@/hooks/useAuthGate';

export default function AuditLogPage() {
  const { ready } = useAuthGate({ roles: ['admin'] });
  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
          Administration
        </p>
        <h1 className="font-display text-3xl gold-text">Audit log</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Append-only record of significant actions in the system.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center"
      >
        <ScrollText className="h-10 w-10 text-gold-400" />
        <p className="font-display text-xl">Reader UI ships in Phase 1.5</p>
        <p className="max-w-md text-sm text-foreground/50">
          Audit events are already being captured in the background — every
          login, invitation, role change, and password set lands in
          <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-xs text-gold-200">
            accounts.AuditLog
          </code>
          . The filterable reader UI lands alongside the live dashboard so it
          shares the same data adapters.
        </p>
      </motion.div>
    </div>
  );
}
