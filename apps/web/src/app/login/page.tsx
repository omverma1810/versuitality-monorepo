'use client';

import { motion } from 'framer-motion';
import { Lock, Mail, Scissors } from 'lucide-react';
import { useEffect, useState } from 'react';

type ApiHealth = { status: string; service: string; time: string };

export default function LoginPage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health/')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="brand-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Parallax accents */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-gold-500/10 blur-3xl"
        animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-navy-400/30 blur-3xl"
        animate={{ y: [0, -25, 0], x: [0, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="glass-panel relative z-10 w-full max-w-md p-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold shadow-gold">
            <Scissors className="h-7 w-7 text-navy-700" strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-3xl tracking-wide gold-text">
            Versuitality
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Bespoke Tailoring Operations · Internal access only
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // Phase 1 will wire this to JWT auth.
          }}
        >
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/60">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="email"
                required
                placeholder="you@versuitality.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/60">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled
            className="w-full rounded-xl bg-gradient-gold py-3 text-sm font-semibold text-navy-700 shadow-gold transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in (wired in Phase 1)
          </button>
        </form>

        <div className="mt-8 border-t border-white/5 pt-4 text-center text-[11px] uppercase tracking-[0.2em] text-foreground/40">
          {error ? (
            <span className="text-status-rejected">API offline · {error}</span>
          ) : health ? (
            <span className="text-status-ready">
              ● API online · {health.service}
            </span>
          ) : (
            <span>● Connecting to API…</span>
          )}
        </div>
      </motion.div>
    </main>
  );
}
