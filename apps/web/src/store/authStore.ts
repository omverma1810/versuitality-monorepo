/**
 * Auth state — Zustand store with localStorage persistence.
 *
 * Holds the access + refresh JWT pair plus the cached user profile, and
 * exposes the actions used by the API client (setTokens / clear) and the UI
 * (login / logout / refreshProfile).
 */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokens, LoginResponse, Role, User } from '@versuitality/types';

interface AuthState {
  user: User | null;
  access: string | null;
  refresh: string | null;
  hydrated: boolean;

  setSession: (resp: LoginResponse) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  clear: () => void;

  isAuthenticated: () => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access: null,
      refresh: null,
      hydrated: false,

      setSession: ({ user, tokens }) =>
        set({ user, access: tokens.access, refresh: tokens.refresh }),
      setTokens: (tokens) =>
        set({ access: tokens.access, refresh: tokens.refresh }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, access: null, refresh: null }),

      isAuthenticated: () => Boolean(get().access && get().user),
      hasRole: (...roles) => {
        const u = get().user;
        if (!u) return false;
        if (u.is_superuser) return true;
        return roles.includes(u.role);
      },
    }),
    {
      name: 'versuitality.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        access: state.access,
        refresh: state.refresh,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
