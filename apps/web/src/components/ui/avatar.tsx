import Image from 'next/image';

import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-gold text-[11px] font-semibold uppercase text-navy-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]',
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}
