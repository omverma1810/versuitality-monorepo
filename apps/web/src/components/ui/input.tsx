'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, icon, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wider text-foreground/60"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl border bg-white/5 py-3 pr-3 text-sm outline-none transition-colors placeholder:text-foreground/30',
              icon ? 'pl-10' : 'pl-3',
              error
                ? 'border-status-rejected/60 focus:border-status-rejected'
                : 'border-white/10 focus:border-gold-500/60 focus:bg-white/10',
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-status-rejected">{error}</p>
        ) : hint ? (
          <p className="text-xs text-foreground/40">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
