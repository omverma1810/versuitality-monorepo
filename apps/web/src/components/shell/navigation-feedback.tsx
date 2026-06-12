'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { toast } from '@/store/toastStore';
import { beginNavigation, completeNavigation, useNavigationStore } from '@/store/navigationStore';

const MIN_VISIBLE_MS = 450;

function deriveLabel(anchor: HTMLAnchorElement) {
  const explicit = anchor.dataset.navLabel?.trim() || anchor.getAttribute('aria-label')?.trim();
  if (explicit) return explicit;
  const title = anchor.getAttribute('title')?.trim();
  if (title) return title;
  const text = anchor.textContent?.replace(/\s+/g, ' ').trim();
  return text || 'Loading';
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingPath = useNavigationStore((s) => s.pendingPath);
  const pendingLabel = useNavigationStore((s) => s.pendingLabel);
  const startedAt = useNavigationStore((s) => s.startedAt);
  const previousPending = useRef<string | null>(null);
  const previousLabel = useRef<string | null>(null);
  const currentPath = useMemo(
    () => `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    [pathname, searchParams],
  );

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.dataset.skipNavigationFeedback === 'true'
      ) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}`;
      if (nextPath === currentPath) return;

      beginNavigation(nextPath, deriveLabel(anchor));
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [currentPath]);

  useEffect(() => {
    if (!pendingPath) {
      if (previousPending.current) {
        toast.success(
          previousLabel.current ? `${previousLabel.current} loaded` : 'Navigation complete',
        );
      }
      previousPending.current = null;
      previousLabel.current = null;
      return;
    }

    if (previousPending.current !== pendingPath) {
      previousPending.current = pendingPath;
      previousLabel.current = pendingLabel ?? null;
      toast.info(pendingLabel ? `Opening ${pendingLabel}` : 'Opening destination');
    }
  }, [pendingLabel, pendingPath]);

  useEffect(() => {
    if (!pendingPath) return;
    if (pendingPath !== currentPath) return;

    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const id = window.setTimeout(() => {
      completeNavigation();
    }, delay);

    return () => window.clearTimeout(id);
  }, [currentPath, pendingPath, startedAt]);

  return (
    <AnimatePresence>
      {pendingPath && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto fixed inset-0 z-[70] flex items-start justify-center bg-navy-950/30 px-4 pt-6 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ y: -12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10">
              <Loader2 className="h-4 w-4 animate-spin text-gold-300" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {pendingLabel ? `Opening ${pendingLabel}` : 'Loading next screen'}
              </p>
              <p className="text-xs text-foreground/50">Please wait while the route settles.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
