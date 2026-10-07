import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';

import { NavigationFeedback } from '@/components/shell/navigation-feedback';
import { ToastViewport } from '@/components/ui/toast-viewport';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Versuitality — Bespoke Tailoring Operations',
  description:
    'Internal operations platform for Versuitality bespoke tailoring house.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} dark`}>
      <body className="min-h-screen">
        {/* useSearchParams() inside NavigationFeedback must sit in a Suspense
            boundary or every statically prerendered route fails to build. */}
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
