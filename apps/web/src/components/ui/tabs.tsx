'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        'flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1',
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'text-gold-200'
                : 'text-foreground/60 hover:text-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                aria-hidden
                className="absolute inset-0 rounded-lg bg-gold-500/15 shadow-[inset_0_0_0_1px_rgba(203,166,36,0.4)]"
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="relative">{t.label}</span>
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'relative rounded-full px-1.5 py-0.5 text-[10px]',
                  isActive
                    ? 'bg-gold-500/30 text-gold-100'
                    : 'bg-white/10 text-foreground/60',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
