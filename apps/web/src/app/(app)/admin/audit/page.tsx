'use client';

import { motion } from 'framer-motion';
import { ScrollText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AUDIT_ACTION_LABELS, fetchAuditLog, type AuditEntry } from '@/lib/audit';

const PAGE = 25;

function describe(e: AuditEntry): string {
  const m = e.metadata ?? {};
  if (e.action === 'order_status_changed') {
    return `${m.order_id ?? ''}: ${String(m.from ?? '').replaceAll('_', ' ')} → ${String(m.to ?? '').replaceAll('_', ' ')}`;
  }
  if (e.action === 'login_failed') return String(m.email ?? '');
  if (e.target_name) return e.target_name;
  return '';
}

export default function AuditLogPage() {
  const { ready } = useAuthGate({ roles: ['admin'] });
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchAuditLog({ action, q, offset, limit: PAGE })
        .then((res) => {
          if (cancelled) return;
          setRows(res.results);
          setCount(res.count);
          setError(null);
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ready, action, q, offset]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">Administration</p>
        <h1 className="font-display text-3xl gold-text">Audit log</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Append-only record of significant actions: sign-ins, invitations, role changes and every order status change.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Search by person or action…"
            aria-label="Search the audit log"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/40"
          />
        </div>
        <select
          value={action}
          onChange={(e) => {
            setOffset(0);
            setAction(e.target.value);
          }}
          aria-label="Filter by action"
          className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-gold-500/40"
        >
          <option value="" className="bg-navy-700">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="bg-navy-700">{label}</option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 p-3 text-sm text-red-200">{error}</p>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wider text-foreground/40">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground/60">
                    {new Date(e.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <p>{e.actor_name}</p>
                    {e.actor_email && <p className="text-xs text-foreground/40">{e.actor_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gold-200">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="px-4 py-3 text-foreground/60">{describe(e)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-foreground/50">
                    <ScrollText className="mx-auto mb-2 h-8 w-8 text-gold-400/60" />
                    Nothing recorded for this filter yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
      )}

      <div className="flex items-center justify-between text-sm text-foreground/60">
        <span>
          {count === 0 ? '0 events' : `${offset + 1}–${Math.min(offset + PAGE, count)} of ${count}`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            Previous
          </Button>
          <Button variant="ghost" size="sm" disabled={offset + PAGE >= count || loading} onClick={() => setOffset(offset + PAGE)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
