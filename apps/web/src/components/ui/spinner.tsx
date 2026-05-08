'use client';

import { motion } from 'framer-motion';

import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
  /** Sets `aria-label`; defaults to "Loading". */
  label?: string;
}

/** Compact branded spinner — gold ring on transparent. */
export function Spinner({ size = 24, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

/** Full-screen brand loader for hydration / route transitions. */
export function BrandedLoader({ message = 'Versuitality' }: { message?: string }) {
  return (
    <main className="brand-grid flex min-h-screen flex-col items-center justify-center gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Logo variant="mark" size={64} />
      </motion.div>
      <Spinner size={20} />
      <p className="text-[11px] uppercase tracking-[0.4em] text-foreground/40">
        {message}
      </p>
    </main>
  );
}
