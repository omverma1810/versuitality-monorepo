'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

import { NAV_GROUPS, type NavItem } from './nav-config';

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const upcoming = item.phase > 1;

  const inner = (
    <>
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          active
            ? 'text-gold-300'
            : upcoming
              ? 'text-foreground/30'
              : 'text-foreground/60 group-hover:text-foreground',
        )}
      />
      {!collapsed && (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span className="truncate">{item.label}</span>
          {upcoming && (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/40">
              P{item.phase}
            </span>
          )}
        </span>
      )}
    </>
  );

  const className = cn(
    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
    active
      ? 'bg-gold-500/10 text-gold-200 shadow-[inset_1px_0_0_0_rgba(203,166,36,0.5)]'
      : 'text-foreground/70 hover:bg-white/5 hover:text-foreground',
    upcoming && !active && 'opacity-60 hover:opacity-90',
    collapsed && 'justify-center px-0',
  );

  if (upcoming) {
    return (
      <div className={cn(className, 'cursor-not-allowed')} title={`${item.label} — coming in Phase ${item.phase}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={item.href} className={className} title={item.label}>
      {active && (
        <motion.span
          layoutId="sidebar-active"
          aria-hidden
          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gradient-gold"
        />
      )}
      {inner}
    </Link>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const hasRole = useAuthStore((s) => s.hasRole);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen flex-col border-r border-white/5 bg-navy-700/40 backdrop-blur-2xl transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[260px]',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-white/5 px-4',
          collapsed ? 'justify-center' : 'gap-3',
        )}
      >
        <Logo variant="mark" size={32} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight gold-text">
              Versuitality
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-foreground/40">
              Operations
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(
            (item) => !item.roles || hasRole(...item.roles),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.title} className="mb-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/30">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {visible.map((item) => (
                  <NavLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'flex h-12 items-center gap-3 border-t border-white/5 px-4 text-xs text-foreground/50 transition-colors hover:bg-white/5 hover:text-foreground',
          collapsed && 'justify-center px-0',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
