'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Step {
  key: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex items-start gap-2', className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                  done && 'border-gold-500/60 bg-gold-500 text-navy-700',
                  active &&
                    'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold',
                  !done && !active && 'border-white/15 text-foreground/40',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'mt-1 h-10 w-px',
                    done ? 'bg-gold-500/50' : 'bg-white/10',
                  )}
                />
              )}
            </div>
            <div className="-mt-0.5 pb-4">
              <p
                className={cn(
                  'text-sm font-medium',
                  active ? 'text-foreground' : 'text-foreground/60',
                )}
              >
                {s.label}
              </p>
              {s.description && (
                <p className="text-[11px] text-foreground/40">{s.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
