'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useEffect } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Versuitality client error:', error);
  }, [error]);

  return (
    <main className="brand-grid flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel relative w-full max-w-md p-8 text-center"
      >
        <div className="mb-3 flex justify-center">
          <Logo variant="mark" size={48} />
        </div>
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-status-rejected/15 text-status-rejected">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl gold-text">Something tore at the seam</h1>
        <p className="mt-2 text-sm text-foreground/60">
          An unexpected error stopped this view from loading. The team has been
          alerted in the console — you can try again or head back home.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-foreground/40">
            digest · {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset} variant="secondary">
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
          <a href="/dashboard" className="inline-block">
            <Button variant="ghost">Dashboard</Button>
          </a>
        </div>
      </motion.div>
    </main>
  );
}
