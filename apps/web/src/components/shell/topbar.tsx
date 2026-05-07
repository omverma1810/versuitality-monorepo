'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, LogOut, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { RoleBadge } from '@/components/ui/role-badge';
import { GlobalSearch } from '@/components/shell/global-search';
import { logout } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const now = useNow();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!user) return null;

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/5 bg-navy-800/60 px-6 backdrop-blur-xl">
      <div className="flex-1">
        <GlobalSearch />
      </div>

      <div className="hidden items-center gap-2 text-xs text-foreground/50 md:flex">
        <Sparkles className="h-3.5 w-3.5 text-gold-400" />
        <span>{now.toLocaleString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })}</span>
        <span className="opacity-50">·</span>
        <span>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
        aria-label="Notifications (coming in Phase 6)"
        title="Notifications coming in Phase 6"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold-400" />
      </button>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-white/10',
            menuOpen && 'bg-white/10',
          )}
        >
          <Avatar name={user.full_name} src={user.avatar_url || null} />
          <div className="hidden min-w-0 flex-col text-xs sm:flex">
            <span className="truncate font-medium text-foreground/90">
              {user.full_name}
            </span>
            <span className="truncate text-foreground/40">{user.email}</span>
          </div>
          <RoleBadge role={user.role} className="hidden md:inline-flex" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="glass-panel absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden p-2"
            >
              <div className="px-3 py-3">
                <p className="text-sm font-medium">{user.full_name}</p>
                <p className="text-xs text-foreground/50">{user.email}</p>
                <div className="mt-2">
                  <RoleBadge role={user.role} />
                </div>
              </div>
              <div className="my-1 h-px bg-white/5" />
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-200 transition-colors hover:bg-status-rejected/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
