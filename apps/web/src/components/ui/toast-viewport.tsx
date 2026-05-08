'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useToastStore, type Toast, type ToastKind } from '@/store/toastStore';

const META: Record<
  ToastKind,
  {
    tone: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
  }
> = {
  success: {
    tone: 'border-status-ready/40 text-emerald-100',
    icon: CheckCircle2,
    iconClass: 'text-status-ready',
  },
  error: {
    tone: 'border-status-rejected/40 text-red-100',
    icon: XCircle,
    iconClass: 'text-status-rejected',
  },
  info: {
    tone: 'border-blue-400/40 text-blue-100',
    icon: Info,
    iconClass: 'text-blue-300',
  },
  warn: {
    tone: 'border-status-trial/40 text-amber-100',
    icon: AlertTriangle,
    iconClass: 'text-status-trial',
  },
};

export function ToastViewport() {
  const queue = useToastStore((s) => s.queue);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[360px] max-w-[90vw] flex-col gap-2"
    >
      <AnimatePresence>
        {queue.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const meta = META[toast.kind];
  const Icon = meta.icon;
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, x: 30, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      className={cn(
        'glass-panel pointer-events-auto flex items-start gap-3 px-3 py-2.5 text-sm',
        meta.tone,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="leading-tight">{toast.text}</p>
        {toast.detail && (
          <p className="mt-0.5 text-[11px] text-foreground/60">{toast.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-0.5 text-foreground/40 transition-colors hover:bg-white/10 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
