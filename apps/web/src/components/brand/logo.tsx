import Image from 'next/image';

import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'mark' | 'wordmark';
  className?: string;
  size?: number;
}

export function Logo({ variant = 'mark', className, size = 40 }: LogoProps) {
  if (variant === 'wordmark') {
    return (
      <Image
        src="/brand/logo.svg"
        alt="Versuitality"
        width={size * 4}
        height={size}
        className={cn('h-auto w-auto', className)}
        priority
      />
    );
  }
  return (
    <Image
      src="/brand/mark.svg"
      alt="Versuitality"
      width={size}
      height={size}
      className={cn(className)}
      priority
    />
  );
}
