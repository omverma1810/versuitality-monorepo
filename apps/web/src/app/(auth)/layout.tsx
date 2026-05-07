import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="brand-grid min-h-screen">{children}</div>;
}
