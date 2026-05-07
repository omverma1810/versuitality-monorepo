'use client';

import { cn } from '@/lib/utils';

interface PreferenceChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  className?: string;
}

export function PreferenceChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: PreferenceChipsProps<T>) {
  function toggle(v: T) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-all',
              active
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
