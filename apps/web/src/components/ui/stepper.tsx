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

/**
 * Vertical stepper — each step on its own row, with a thin gold connector
 * line linking the circles. Designed to live in a narrow (~280px) sidebar
 * column without overflowing into the form column on the right.
 */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === steps.length - 1;
        return (
          <li key={s.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center self-stretch">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                  done && 'border-gold-500/60 bg-gold-500 text-navy-700',
                  active &&
                    'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold',
                  !done && !active && 'border-white/15 text-foreground/40',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'my-1 w-px flex-1',
                    done ? 'bg-gold-500/50' : 'bg-white/10',
                  )}
                />
              )}
            </div>
            <div
              className={cn('-mt-0.5 min-w-0 flex-1', !isLast && 'pb-5')}
            >
              <p
                className={cn(
                  'truncate text-sm font-medium leading-tight',
                  active ? 'text-foreground' : 'text-foreground/60',
                )}
              >
                {s.label}
              </p>
              {s.description && (
                <p className="mt-0.5 truncate text-[11px] leading-tight text-foreground/40">
                  {s.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
