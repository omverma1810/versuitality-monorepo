'use client';

import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  detail?: string;
  /** Auto-dismiss after N ms. Pass 0 to keep it sticky. */
  duration: number;
}

interface ToastState {
  queue: Toast[];
  push: (input: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  queue: [],
  push: ({ kind, text, detail, duration = 4500 }) => {
    const id = nextId++;
    set((s) => ({ queue: [...s.queue, { id, kind, text, detail, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ queue: s.queue.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
  clear: () => set({ queue: [] }),
}));

/** Convenience helpers — import and call from anywhere. */
export const toast = {
  success: (text: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'success', text, detail }),
  error: (text: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'error', text, detail, duration: 6500 }),
  info: (text: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'info', text, detail }),
  warn: (text: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'warn', text, detail, duration: 6000 }),
};
