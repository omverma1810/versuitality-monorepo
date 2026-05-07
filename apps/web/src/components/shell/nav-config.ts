import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Receipt,
  Scissors,
  ShieldCheck,
  Users,
} from 'lucide-react';

import type { Role } from '@versuitality/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  /** Phase that introduces this surface (so Phase 1 can stub Coming Soon). */
  phase: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, phase: 1 },
      {
        href: '/clients',
        label: 'Clients',
        icon: Users,
        roles: ['admin', 'staff', 'master'],
        phase: 1, // live as of Phase 2 — set to <=1 so it isn't badged "P2"
      },
      {
        href: '/orders',
        label: 'Orders',
        icon: Receipt,
        roles: ['admin', 'staff', 'master', 'qa', 'accountant'],
        phase: 3,
      },
      {
        href: '/qa',
        label: 'Quality Check',
        icon: ClipboardCheck,
        roles: ['admin', 'qa'],
        phase: 5,
      },
      {
        href: '/appointments',
        label: 'Appointments',
        icon: CalendarDays,
        roles: ['admin', 'staff'],
        phase: 7,
      },
    ],
  },
  {
    title: 'Supply chain',
    items: [
      {
        href: '/inventory',
        label: 'Inventory',
        icon: Boxes,
        roles: ['admin', 'staff', 'master'],
        phase: 7,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        href: '/admin/users',
        label: 'Team & roles',
        icon: ShieldCheck,
        roles: ['admin'],
        phase: 1,
      },
      {
        href: '/admin/analytics',
        label: 'Analytics',
        icon: BarChart3,
        roles: ['admin', 'accountant'],
        phase: 8,
      },
      {
        href: '/admin/audit',
        label: 'Audit log',
        icon: Scissors,
        roles: ['admin'],
        phase: 1,
      },
    ],
  },
];
