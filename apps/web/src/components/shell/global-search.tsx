'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, Phone, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { searchClients } from '@/lib/clients';
import { cn } from '@/lib/utils';
import { beginNavigation } from '@/store/navigationStore';
import type { ClientSummary } from '@versuitality/types';

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounced search
  useEffect(() => {
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
  }, [q]);

  // Outside-click close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Cmd/Ctrl-K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function go(id: string) {
    setNavigatingTo(id);
    setOpen(false);
    setQ('');
    beginNavigation(`/clients/${id}`, 'Opening client profile');
    router.push(`/clients/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      const r = results[highlight];
      if (r) go(r.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
      <input
        ref={inputRef}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search clients by name, mobile, or ID…"
        className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-16 text-sm outline-none transition-colors placeholder:text-foreground/30 focus:border-gold-500/40 focus:bg-white/[0.06]"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-foreground/40 md:flex">
        <kbd className="font-mono">⌘</kbd>
        <kbd className="font-mono">K</kbd>
      </span>
      {q && (
        <button
          onClick={() => {
            setQ('');
            inputRef.current?.focus();
          }}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground md:right-14"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <AnimatePresence>
        {open && q.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="glass-panel absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden p-2"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-foreground/50">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-xs text-foreground/40">
                No clients match “{q}”
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => go(r.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        highlight === i ? 'bg-white/10' : 'hover:bg-white/5',
                      )}
                    >
                      <Avatar name={r.full_name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {r.full_name}{' '}
                          <span className="font-mono text-[10px] text-gold-300/70">
                            {r.client_id}
                          </span>
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-foreground/50">
                          <Phone className="h-3 w-3" />
                          {r.mobile}
                          {r.email && (
                            <span className="text-foreground/30">· {r.email}</span>
                          )}
                        </p>
                      </div>
                      {navigatingTo === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-300" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-foreground/30 group-hover:text-gold-300" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
