'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

import { NAV_GROUPS, type NavItem } from './nav-config';

/**
 * Five-slot mobile navigation. Picks the most relevant role-aware items so
 * staff on tablets and phones can reach every primary surface from one tap.
 */
export function BottomNav() {
  const pathname = usePathname();
  const hasRole = useAuthStore((s) => s.hasRole);

  const items = NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => item.phase <= 1)
    .filter((item) => !item.roles || hasRole(...item.roles))
    .slice(0, 5);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/5 bg-navy-800/80 backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Slot key={item.href} item={item} active={active} />;
      })}
    </nav>
  );
}

function Slot({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] uppercase tracking-wider transition-colors',
        active ? 'text-gold-200' : 'text-foreground/55 hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="bottom-nav-active"
          aria-hidden
          className="absolute top-0 h-0.5 w-10 rounded-full bg-gradient-gold"
        />
      )}
      <Icon className="h-4 w-4" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
