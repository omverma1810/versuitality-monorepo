'use client';

import { motion } from 'framer-motion';
import { History, Repeat2, Ruler, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MEASUREMENT_KEYS,
  MEASUREMENT_LABELS,
  ORDER_STATUS_LABELS,
  type ClientProfile,
  type RecentOrder,
} from '@versuitality/types';

/** Measurements older than this are flagged so the front desk can offer a refresh. */
export const STALE_MEASUREMENT_DAYS = 180;

function ago(days: number | null | undefined): string {
  if (days == null) return '';
  if (days < 1) return 'today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : `${(days / 365).toFixed(1)} years ago`;
}

interface Props {
  clientId: string;
  name: string;
  profile: ClientProfile;
  /** Offered on the order wizard: copies that order's garments into the new one. */
  onRepeat?: (order: RecentOrder) => void;
  /** Where "update measurements" should return to once saved. */
  returnTo?: string;
  className?: string;
}

export function ReturningClientCard({ clientId, name, profile, onRepeat, returnTo, className }: Props) {
  const m = profile.latest_measurement;
  const highlights = m
    ? MEASUREMENT_KEYS.filter((k) => m[k] !== undefined && m[k] !== null && m[k] !== '')
        .slice(0, 8)
        .map((k) => ({ label: MEASUREMENT_LABELS[k], value: Number(m[k]) }))
    : [];
  const stale = (profile.measurement_age_days ?? 0) >= STALE_MEASUREMENT_DAYS;
  const firstName = name.split(' ')[0];
  const measureHref = `/clients/${clientId}/measurements/new${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Returning client"
      className={cn('rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-5', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold-300" />
        <h3 className="font-display text-lg">
          Welcome back, <span className="gold-text">{firstName}</span>
        </h3>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-foreground/55">
          <History className="h-3.5 w-3.5" />
          {profile.order_count} previous order{profile.order_count === 1 ? '' : 's'}
          {profile.last_visit_at && <> · last visit {ago(Math.floor((Date.now() - new Date(profile.last_visit_at).getTime()) / 864e5))}</>}
        </span>
      </div>

      {m ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/50">
            <Ruler className="h-3.5 w-3.5 text-gold-400" />
            Latest measurements · {new Date(m.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            <span className="normal-case tracking-normal text-foreground/40">({ago(profile.measurement_age_days)})</span>
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Latest measurements">
            {highlights.map((h) => (
              <li key={h.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                <span className="text-foreground/50">{h.label}</span> <span className="font-mono text-gold-200">{h.value}</span>
              </li>
            ))}
          </ul>
          {stale && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              These were taken {ago(profile.measurement_age_days)}. Bodies change — offer a quick re-measure.
            </p>
          )}
          <Link href={measureHref as never} className="mt-3 inline-block">
            <Button variant="ghost" size="sm">
              <Ruler className="h-3.5 w-3.5" />
              Update measurements (pre-filled)
            </Button>
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-sm text-foreground/60">
          No measurements on file yet.{' '}
          <Link href={measureHref as never} className="text-gold-300 hover:underline">
            Capture them now
          </Link>
          .
        </p>
      )}

      {profile.recent_orders.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-foreground/50">Previous orders</p>
          <ul className="space-y-2">
            {profile.recent_orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-mono text-[11px] text-gold-300/80">{o.order_id}</span>{' '}
                    <span className="text-foreground/80">{o.garment_summary || 'No garments'}</span>
                  </p>
                  <p className="text-xs text-foreground/45">
                    {new Date(o.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
                    {ORDER_STATUS_LABELS[o.status]} · ₹ {Number(o.subtotal).toLocaleString()}
                  </p>
                </div>
                {onRepeat && o.line_items.length > 0 && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRepeat(o)} aria-label={`Repeat order ${o.order_id}`}>
                    <Repeat2 className="h-3.5 w-3.5" />
                    Repeat
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
