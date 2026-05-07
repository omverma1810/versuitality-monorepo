'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { hydrated, access, user } = useAuthStore(
    useShallow((s) => ({ hydrated: s.hydrated, access: s.access, user: s.user })),
  );

  useEffect(() => {
    if (!hydrated) return;
    router.replace(access && user ? '/dashboard' : '/login');
  }, [hydrated, access, user, router]);

  return (
    <main className="brand-grid flex min-h-screen items-center justify-center">
      <div
        aria-hidden
        className="h-12 w-12 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500"
      />
    </main>
  );
}
