'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, KeyRound, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { RoleBadge } from '@/components/ui/role-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { lookupInvite, setupPassword } from '@/lib/auth';
import type { InviteLookup } from '@versuitality/types';

type Stage = 'loading' | 'ready' | 'invalid' | 'submitting' | 'done';

export default function SetupPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [stage, setStage] = useState<Stage>('loading');
  const [invite, setInvite] = useState<InviteLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!token) {
      setStage('invalid');
      setError('No invitation token was provided.');
      return;
    }
    lookupInvite(token)
      .then((data) => {
        setInvite(data);
        setStage('ready');
      })
      .catch((err) => {
        setStage('invalid');
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not validate this invitation.',
        );
      });
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setStage('submitting');
    try {
      await setupPassword(token, password, confirm);
      setStage('done');
      setTimeout(() => router.replace('/dashboard'), 900);
    } catch (err) {
      setStage('ready');
      if (err instanceof ApiError && typeof err.data === 'object' && err.data) {
        const data = err.data as Record<string, unknown>;
        const first =
          (Array.isArray(data.password) && data.password[0]) ||
          (Array.isArray(data.password_confirm) && data.password_confirm[0]) ||
          (Array.isArray(data.token) && data.token[0]) ||
          err.message;
        setError(String(first));
      } else {
        setError('Could not set your password. Please try again.');
      }
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-40 h-[420px] w-[420px] rounded-full bg-gold-500/10 blur-3xl"
        animate={{ y: [0, 18, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="glass-panel relative z-10 w-full max-w-md p-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="mark" size={56} className="mb-4" />
          <h1 className="font-display text-2xl tracking-wide gold-text">
            Activate your account
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Welcome to Versuitality. Set a password to get started.
          </p>
        </div>

        {stage === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8 text-foreground/60">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
            <p className="text-xs">Validating your invitation…</p>
          </div>
        )}

        {stage === 'invalid' && (
          <div className="space-y-4 text-center">
            <p className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-3 text-sm text-red-200">
              {error ?? 'This invitation is no longer valid.'}
            </p>
            <Button variant="secondary" onClick={() => router.replace('/login')}>
              Back to sign in
            </Button>
          </div>
        )}

        {stage === 'done' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
          >
            <CheckCircle2 className="h-10 w-10 text-status-ready" />
            <p className="font-display text-lg gold-text">Welcome aboard.</p>
            <p className="text-xs text-foreground/60">Taking you to the dashboard…</p>
          </motion.div>
        )}

        {(stage === 'ready' || stage === 'submitting') && invite && (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invite.full_name}</p>
                  <p className="truncate text-xs text-foreground/50">{invite.email}</p>
                </div>
                <RoleBadge role={invite.role} />
              </div>
            </div>

            <Input
              name="password"
              type="password"
              label="New password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              icon={<KeyRound className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={stage === 'submitting'}
            />
            <Input
              name="confirm"
              type="password"
              label="Confirm password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              icon={<Lock className="h-4 w-4" />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={stage === 'submitting'}
            />

            {error && (
              <p className="rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={stage === 'submitting'}
            >
              Activate account
            </Button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
