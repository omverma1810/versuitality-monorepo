'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  FileSpreadsheet,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Ruler,
  Sparkles,
  StickyNote,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { StatusBadge } from '@/components/orders/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { useAuthGate } from '@/hooks/useAuthGate';
import { exportMeasurementsXlsx, getClient } from '@/lib/clients';
import { listMeasurements } from '@/lib/measurements';
import { listOrders } from '@/lib/orders';
import { cn } from '@/lib/utils';
import {
  AGE_GROUP_LABELS,
  FABRIC_LABELS,
  GARMENT_LABELS,
  OCCASION_LABELS,
  type Client,
  type MeasurementSet,
  type OrderListItem,
} from '@versuitality/types';

export default function ClientProfilePage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff', 'master'] });
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const [client, setClient] = useState<Client | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementSet[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [tab, setTab] = useState<'overview' | 'measurements' | 'orders' | 'notes'>(
    'overview',
  );
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(search.get('welcome') === '1');

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([
      getClient(params.id as string),
      listMeasurements(params.id as string),
      listOrders({ client: params.id as string }),
    ])
      .then(([c, m, o]) => {
        if (cancelled) return;
        setClient(c);
        setMeasurements(m.results);
        setOrders(o.results);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ready, params.id]);

  useEffect(() => {
    if (!showWelcome) return;
    const t = setTimeout(() => setShowWelcome(false), 4500);
    return () => clearTimeout(t);
  }, [showWelcome]);

  if (!ready || !client) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
      </div>
    );
  }

  async function exportXlsx() {
    if (!client) return;
    setExporting(true);
    try {
      await exportMeasurementsXlsx(client);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/clients"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
          Client profile
        </p>
      </div>

      {showWelcome && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-xl border border-status-ready/40 bg-status-ready/10 px-4 py-2 text-sm text-emerald-200"
        >
          ✓ Saved. {client.full_name}&apos;s profile is ready and the measurement
          set has been linked.
        </motion.div>
      )}

      {/* Header card */}
      <section className="glass-panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-gold-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={client.full_name} size={64} />
            <div>
              <h1 className="font-display text-3xl gold-text">
                {client.full_name}
              </h1>
              <p className="font-mono text-xs uppercase tracking-wider text-gold-300/80">
                {client.client_id}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.mobile}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </span>
                )}
                {client.age_group && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {AGE_GROUP_LABELS[client.age_group as keyof typeof AGE_GROUP_LABELS]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportXlsx} loading={exporting}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel export
            </Button>
            <Link href={`/clients/${client.id}/measurements/new`}>
              <Button>
                <Ruler className="h-4 w-4" />
                New measurement
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Measurements" value={measurements.length} />
          <Stat label="Orders" value={client.order_count ?? 0} hint="Phase 3" />
          <Stat
            label="Joined"
            value={new Date(client.created_at).toLocaleDateString()}
          />
          <Stat
            label="Last visit"
            value={
              measurements[0]
                ? new Date(measurements[0].created_at).toLocaleDateString()
                : '—'
            }
          />
        </div>
      </section>

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'measurements', label: 'Measurements', count: measurements.length },
          { key: 'orders', label: 'Orders', count: orders.length },
          { key: 'notes', label: 'Notes' },
        ]}
      />

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {tab === 'overview' && <OverviewTab client={client} />}
      {tab === 'measurements' && <MeasurementsTab measurements={measurements} />}
      {tab === 'orders' && <OrdersTab orders={orders} clientId={client.id} />}
      {tab === 'notes' && <NotesTab client={client} />}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl tabular-nums">{value}</p>
        {hint && (
          <span className="text-[9px] uppercase tracking-wider text-foreground/40">
            ({hint})
          </span>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ client }: { client: Client }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="glass-panel space-y-3 p-5 lg:col-span-2">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Style preferences</h2>
        </div>
        <PreferenceRow
          label="Occasions"
          values={client.occasion_preferences ?? []}
          map={OCCASION_LABELS}
        />
        <PreferenceRow
          label="Fabrics"
          values={client.fabric_preferences ?? []}
          map={FABRIC_LABELS}
        />
        {client.notes && (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
            <p className="mb-1 text-xs uppercase tracking-wider text-foreground/40">
              Internal notes
            </p>
            <p className="text-foreground/80">{client.notes}</p>
          </div>
        )}
      </div>

      <div className="glass-panel space-y-3 p-5">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gold-400" />
          <h2 className="font-display text-lg">Contact</h2>
        </div>
        <Field label="Mobile" value={client.mobile} mono />
        {client.alt_mobile && (
          <Field label="Alternate" value={client.alt_mobile} mono />
        )}
        {client.email && <Field label="Email" value={client.email} />}
        {client.address && <Field label="Address" value={client.address} multiline />}
      </div>
    </div>
  );
}

function PreferenceRow<T extends string>({
  label,
  values,
  map,
}: {
  label: string;
  values: T[];
  map: Record<T, string>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      {values.length === 0 ? (
        <p className="text-xs text-foreground/40">— not specified</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-foreground/80"
            >
              {map[v]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <p
        className={cn(
          'text-sm',
          mono && 'font-mono tabular-nums',
          multiline && 'whitespace-pre-line',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MeasurementsTab({ measurements }: { measurements: MeasurementSet[] }) {
  if (measurements.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
        <Ruler className="h-10 w-10 text-foreground/30" />
        <p className="font-display text-xl">No measurements yet</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {measurements.map((m, i) => (
        <motion.li
          key={m.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="glass-panel p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gold-400" />
              <span className="font-medium">
                {new Date(m.created_at).toLocaleString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {m.garment_types.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold-200"
                >
                  {GARMENT_LABELS[g]}
                </span>
              ))}
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-foreground/60">
                {m.garment_count} item{m.garment_count > 1 && 's'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              ['Chest', m.upper_chest],
              ['Waist', m.upper_waist],
              ['Hip', m.upper_hip],
              ['Shoulder', m.upper_shoulder],
              ['Sleeve', m.upper_sleeve],
              ['Length', m.upper_length],
              ['Pant L', m.lower_length],
              ['Inseam', m.lower_inseam],
              ['Knee', m.lower_knee],
              ['Bottom', m.lower_bottom],
              ['Pant W', m.lower_waist],
              ['Thigh', m.lower_thigh],
            ].map(([label, value]) => {
              if (!value) return null;
              return (
                <div
                  key={label as string}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs"
                >
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                    {label}
                  </p>
                  <p className="font-mono tabular-nums text-foreground/90">
                    {String(value)}″
                  </p>
                </div>
              );
            })}
          </div>

          {(m.fabric_details || m.customization_notes || m.cloth_image) && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {m.cloth_image && (
                <a
                  href={m.cloth_image}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative flex h-32 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.cloth_image}
                    alt="Cloth"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-navy-900/70 px-1.5 py-0.5 text-[10px]">
                    <ImageIcon className="inline h-3 w-3" /> View
                  </span>
                </a>
              )}
              {m.fabric_details && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs md:col-span-1">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-foreground/40">
                    Fabric
                  </p>
                  <p>{m.fabric_details}</p>
                </div>
              )}
              {m.customization_notes && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs md:col-span-1">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-foreground/40">
                    Customization
                  </p>
                  <p>{m.customization_notes}</p>
                </div>
              )}
            </div>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function OrdersTab({
  orders,
  clientId,
}: {
  orders: OrderListItem[];
  clientId: string;
}) {
  if (orders.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 p-12 text-center">
        <Receipt className="h-10 w-10 text-gold-400" />
        <p className="font-display text-xl">No orders yet</p>
        <p className="max-w-md text-sm text-foreground/50">
          Create the client&apos;s first bespoke order — the measurement set you
          captured will be linked, and a PDF receipt is generated on save.
        </p>
        <Link href={`/orders/new?client=${clientId}`}>
          <Button>
            <Plus className="h-4 w-4" />
            New order for this client
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link href={`/orders/new?client=${clientId}`}>
          <Button>
            <Plus className="h-4 w-4" />
            New order
          </Button>
        </Link>
      </div>
      <ul className="space-y-2">
        {orders.map((o, i) => (
          <motion.li
            key={o.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              href={`/orders/${o.id}`}
              className="glass-panel group flex items-center justify-between gap-3 p-4 transition-colors hover:border-gold-500/30 hover:bg-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-gold-300/80">
                  {o.order_id}
                </p>
                <p className="truncate text-sm text-foreground/80">
                  {o.garment_summary || `${o.line_item_count ?? 0} items`}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/50">
                  {new Date(o.created_at).toLocaleDateString()} · ₹{' '}
                  {Number(o.subtotal).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function NotesTab({ client }: { client: Client }) {
  return (
    <div className="glass-panel space-y-3 p-5">
      <div className="mb-1 flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-gold-400" />
        <h2 className="font-display text-lg">Internal notes</h2>
      </div>
      {client.notes ? (
        <p className="whitespace-pre-line rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
          {client.notes}
        </p>
      ) : (
        <p className="text-sm text-foreground/40">
          No notes yet. Inline editing of notes lands alongside Phase 3 order
          flagging.
        </p>
      )}
    </div>
  );
}
