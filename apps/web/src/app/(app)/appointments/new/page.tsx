'use client';

import { ArrowLeft, CalendarDays, Check, Clock, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ClientPicker } from '@/components/orders/client-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { createAppointment } from '@/lib/appointments';
import { cn } from '@/lib/utils';
import {
  APPOINTMENT_KIND_LABELS,
  type AppointmentKind,
  type ClientSummary,
  type NotifyVia,
} from '@versuitality/types';

const KINDS: AppointmentKind[] = [
  'measurement',
  'trial',
  'consultation',
  'delivery',
  'other',
];

const NOTIFY_OPTIONS: { value: NotifyVia; label: string }[] = [
  { value: 'both', label: 'Email + WhatsApp' },
  { value: 'email', label: 'Email only' },
  { value: 'whatsapp', label: 'WhatsApp only' },
  { value: 'none', label: 'Silent — no reminder' },
];

export default function NewAppointmentPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const router = useRouter();

  const [client, setClient] = useState<ClientSummary | null>(null);
  const [kind, setKind] = useState<AppointmentKind>('measurement');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(30);
  const [notifyVia, setNotifyVia] = useState<NotifyVia>('both');

  // For prospect (no CRM client yet) appointments
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  const canSubmit =
    Boolean(scheduledAt) && (Boolean(client) || fullName.trim().length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setSubmitting(true);
    setError(null);
    try {
      // Normalise the local datetime input to ISO. ``datetime-local`` returns
      // an unzoned string; new Date() interprets it as local time.
      const iso = new Date(scheduledAt).toISOString();
      const a = await createAppointment({
        client: client?.id ?? null,
        full_name: client?.full_name ?? fullName.trim(),
        mobile: client?.mobile ?? mobile,
        email: email,
        scheduled_at: iso,
        duration_minutes: duration,
        kind,
        notify_via: notifyVia,
        notes,
      });
      router.replace(`/appointments?focus=${a.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Could not save the appointment.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/appointments"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Appointments
          </p>
          <h1 className="font-display text-3xl gold-text">New appointment</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <section className="glass-panel p-6">
          <h2 className="mb-3 font-display text-lg">Client</h2>
          <ClientPicker selected={client} onSelect={setClient} />
          {!client && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Walk-in name (no CRM record yet)"
                required
              />
              <Input
                label="Mobile"
                icon={<Phone className="h-4 w-4" />}
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 …"
              />
              <Input
                label="Email"
                type="email"
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
          )}
        </section>

        <section className="glass-panel space-y-4 p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gold-400" />
            <h2 className="font-display text-lg">When & what</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Date & time"
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                Duration (min)
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors focus-within:border-gold-500/60">
                <Clock className="h-3.5 w-3.5 text-foreground/40" />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 30))}
                  className="w-full bg-transparent text-sm tabular-nums outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                Reminders
              </label>
              <select
                value={notifyVia}
                onChange={(e) => setNotifyVia(e.target.value as NotifyVia)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60"
              >
                {NOTIFY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-navy-700">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-all',
                    kind === k
                      ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                      : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
                  )}
                >
                  {APPOINTMENT_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
              Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything relevant — what to prepare, who they'll meet…"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            <Check className="h-4 w-4" />
            Schedule appointment
          </Button>
        </div>
      </form>
    </div>
  );
}
