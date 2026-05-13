'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ScissorsLineDashed } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="brand-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-gold-500/10 blur-3xl"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-panel relative w-full max-w-md p-10 text-center"
      >
        <div className="mb-4 flex justify-center">
          <Logo variant="mark" size={48} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-300/80">
          Error 404
        </p>
        <h1 className="mt-2 font-display text-3xl gold-text">
          Off the cutting table
        </h1>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-foreground/60">
          <ScissorsLineDashed className="h-4 w-4 text-gold-400" />
          The page you&apos;re looking for couldn&apos;t be found.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back to the dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
