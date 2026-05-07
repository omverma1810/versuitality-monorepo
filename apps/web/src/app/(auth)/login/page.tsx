'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { login } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';

type ApiHealth = { status: string; service: string; time: string };

export default function LoginPage() {
  const router = useRouter();
  const { hydrated, access, user } = useAuthStore(
    useShallow((s) => ({ hydrated: s.hydrated, access: s.access, user: s.user })),
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && access && user) router.replace('/dashboard');
  }, [hydrated, access, user, router]);

  useEffect(() => {
    fetch('/api/health/')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setHealth)
      .catch((e) => setHealthError(String(e)));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
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
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]"
      >
        <div
          className="h-[700px] w-[700px] rounded-full border border-gold-500"
          style={{ boxShadow: 'inset 0 0 200px rgba(203, 166, 36, 0.4)' }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="glass-panel relative z-10 w-full max-w-md p-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="mark" size={56} className="mb-4" />
          <h1 className="font-display text-3xl tracking-wide gold-text">
            Versuitality
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Bespoke Tailoring Operations · Internal access only
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <Input
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
            placeholder="you@versuitality.com"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <Input
            name="password"
            type="password"
            label="Password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-foreground/50">
          <ShieldCheck className="h-3.5 w-3.5 text-gold-400" />
          Closed system · Access by invitation only
        </div>

        <div className="mt-4 border-t border-white/5 pt-4 text-center text-[11px] uppercase tracking-[0.2em] text-foreground/40">
          {healthError ? (
            <span className="text-status-rejected">API offline · {healthError}</span>
          ) : health ? (
            <span className="text-status-ready">● API online · {health.service}</span>
          ) : (
            <span>● Connecting to API…</span>
          )}
        </div>
      </motion.div>
    </main>
  );
}
