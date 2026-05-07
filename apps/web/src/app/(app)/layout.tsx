'use client';

import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, hydrated } = useAuthGate();

  if (!hydrated || !ready) {
    return (
      <main className="brand-grid flex min-h-screen items-center justify-center">
        <div
          aria-hidden
          className="h-12 w-12 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500"
        />
      </main>
    );
  }

  return (
    <div className="brand-grid min-h-screen">
      <div className="flex">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
