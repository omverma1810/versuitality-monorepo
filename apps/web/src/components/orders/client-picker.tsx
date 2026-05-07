'use client';

import { motion } from 'framer-motion';
import { Phone, Search, UserCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { searchClients } from '@/lib/clients';
import { cn } from '@/lib/utils';
import type { ClientSummary } from '@versuitality/types';

interface Props {
  selected: ClientSummary | null;
  onSelect: (c: ClientSummary | null) => void;
}

export function ClientPicker({ selected, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selected) return;
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      searchClients(q)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, selected]);

  if (selected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel flex items-center gap-3 p-4"
      >
        <Avatar name={selected.full_name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">
            {selected.full_name}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
            {selected.client_id}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-foreground/60">
            <Phone className="h-3 w-3" />
            {selected.mobile}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="rounded-lg border border-white/10 p-1.5 text-foreground/50 hover:bg-white/5 hover:text-foreground"
          aria-label="Change client"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile, last 4 digits, or client ID…"
          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-foreground/30 focus:border-gold-500/40 focus:bg-white/[0.08]"
        />
      </div>
      <div className="glass-panel max-h-64 overflow-y-auto p-1">
        {loading ? (
          <p className="flex items-center gap-2 px-3 py-3 text-xs text-foreground/50">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
            Searching…
          </p>
        ) : !q.trim() ? (
          <p className="flex items-center gap-2 px-3 py-3 text-xs text-foreground/40">
            <UserCircle2 className="h-4 w-4" />
            Pick the client this order is for, or
            <a
              href="/clients/new"
              className="text-gold-300 underline-offset-2 hover:underline"
            >
              register a new walk-in
            </a>
            .
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 text-xs text-foreground/40">
            No clients match “{q}”. Try a different spelling or
            <a
              href="/clients/new"
              className="ml-1 text-gold-300 underline-offset-2 hover:underline"
            >
              register a new client
            </a>
            .
          </p>
        ) : (
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setQ('');
                    setResults([]);
                  }}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5',
                  )}
                >
                  <Avatar name={c.full_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {c.full_name}{' '}
                      <span className="font-mono text-[10px] text-gold-300/70">
                        {c.client_id}
                      </span>
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-foreground/50">
                      <Phone className="h-3 w-3" />
                      {c.mobile}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
