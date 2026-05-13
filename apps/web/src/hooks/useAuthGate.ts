'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { fetchMe } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@versuitality/types';

interface Options {
  /** If set, requires the user to hold one of these roles. */
  roles?: Role[];
  /** Where to send unauthenticated users (default /login). */
  redirectTo?: Route;
}

/**
 * Client-side route guard. Returns the auth state for the consumer to render
 * a loading skeleton while hydrating / verifying.
 */
export function useAuthGate({ roles, redirectTo = '/login' }: Options = {}) {
  const router = useRouter();
  const { user, access, hydrated, hasRole } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      access: s.access,
      hydrated: s.hydrated,
      hasRole: s.hasRole,
    })),
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!access || !user) {
      router.replace(redirectTo);
      return;
    }
    if (roles && roles.length > 0 && !hasRole(...roles)) {
      router.replace('/dashboard');
    }
  }, [hydrated, access, user, roles, redirectTo, router, hasRole]);

  // Refresh /me in the background so server-side role/active changes propagate.
  useEffect(() => {
    if (hydrated && access && user) {
      fetchMe().catch(() => {
        /* the api client handles 401-driven logout */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const ready =
    hydrated && Boolean(access && user) && (!roles || hasRole(...roles));

  return { ready, user, hydrated };
}
