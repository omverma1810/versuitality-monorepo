'use client';

import { create } from 'zustand';

interface NavigationState {
  pendingPath: string | null;
  pendingLabel: string | null;
  startedAt: number | null;
  start: (path: string, label?: string) => void;
  clear: () => void;
}

let fallbackTimer: number | null = null;

function clearFallbackTimer() {
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  pendingPath: null,
  pendingLabel: null,
  startedAt: null,
  start: (path, label) => {
    const current = get().pendingPath;
    if (current === path) return;
    clearFallbackTimer();
    set({
      pendingPath: path,
      pendingLabel: label ?? null,
      startedAt: Date.now(),
    });
    fallbackTimer = window.setTimeout(() => {
      set({
        pendingPath: null,
        pendingLabel: null,
        startedAt: null,
      });
    }, 15000);
  },
  clear: () => {
    clearFallbackTimer();
    set({
      pendingPath: null,
      pendingLabel: null,
      startedAt: null,
    });
  },
}));

export function beginNavigation(path: string, label?: string) {
  useNavigationStore.getState().start(path, label);
}

export function completeNavigation() {
  useNavigationStore.getState().clear();
}
