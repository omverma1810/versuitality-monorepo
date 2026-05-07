import { ROLE_LABELS, type Role } from '@versuitality/types';

import { cn } from '@/lib/utils';

const ROLE_TONE: Record<Role, string> = {
  admin: 'border-gold-500/40 bg-gold-500/15 text-gold-200',
  staff: 'border-status-production/40 bg-status-production/15 text-blue-200',
  master: 'border-purple-400/40 bg-purple-400/15 text-purple-200',
  qa: 'border-status-trial/40 bg-status-trial/15 text-amber-200',
  accountant: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
};

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider',
        ROLE_TONE[role],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROLE_LABELS[role]}
    </span>
  );
}
