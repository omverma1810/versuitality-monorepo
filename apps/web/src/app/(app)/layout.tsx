'use client';

import { BottomNav } from '@/components/shell/bottom-nav';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { BrandedLoader } from '@/components/ui/spinner';
import { ToastViewport } from '@/components/ui/toast-viewport';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, hydrated } = useAuthGate();

  if (!hydrated || !ready) {
    return <BrandedLoader />;
  }

  return (
    <div className="brand-grid min-h-screen">
      {/* Skip-to-content for keyboard + screen-reader users. */}
      <a
        href="#app-main"
        className="absolute left-3 top-3 z-[60] -translate-y-20 rounded-lg bg-gold-500 px-3 py-2 text-xs font-semibold text-navy-700 shadow-gold transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <div className="flex">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main
            id="app-main"
            className="flex-1 px-4 pb-24 pt-6 sm:px-6 sm:py-8 lg:pb-8"
          >
            {children}
          </main>
        </div>
      </div>

      <BottomNav />
      <ToastViewport />
    </div>
  );
}
