'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  IndianRupee,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ClientPicker } from '@/components/orders/client-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { getClient } from '@/lib/clients';
import { listMeasurements } from '@/lib/measurements';
import { listFabrics } from '@/lib/inventory';
import { createOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import {
  GARMENT_LABELS,
  ORDER_TYPE_LABELS,
  type ClientSummary,
  type Fabric,
  type GarmentType,
  type MeasurementSet,
  type OrderType,
} from '@versuitality/types';

const STEPS = [
  { key: 'client', label: 'Client', description: 'Who is this for' },
  { key: 'garments', label: 'Garments', description: 'Line items' },
  { key: 'measurements', label: 'Measurements', description: 'Link the visit' },
  { key: 'review', label: 'Review', description: 'Save & generate PDF' },
];

interface DraftLine {
  garment_type: GarmentType;
  fabric_description: string;
  fabric_id: string | null;
  meters_used: string;
  quantity: number;
  unit_price: string;
  customization_notes: string;
}

const EMPTY_LINE: DraftLine = {
  garment_type: 'shirt',
  fabric_description: '',
  fabric_id: null,
  meters_used: '',
  quantity: 1,
  unit_price: '',
  customization_notes: '',
};

const GARMENT_OPTIONS: GarmentType[] = [
  'shirt',
  'kurta',
  'pant',
  'trouser',
  'suit',
  'blazer',
  'sherwani',
  'waistcoat',
  'jodhpuri',
];

export default function NewOrderPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const router = useRouter();
  const search = useSearchParams();
  const preselectedClientId = search.get('client');

  const [step, setStep] = useState(0);
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('full');
  const [trialDate, setTrialDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);

  useEffect(() => {
    if (!ready) return;
    listFabrics({ active: true })
      .then((d) => setFabrics(d.results))
      .catch(() => undefined);
  }, [ready]);

  const [measurements, setMeasurements] = useState<MeasurementSet[]>([]);
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preselect a client if linking from a client profile.
  useEffect(() => {
    if (!ready || !preselectedClientId) return;
    getClient(preselectedClientId)
      .then((c) =>
        setClient({
          id: c.id,
          client_id: c.client_id,
          full_name: c.full_name,
          mobile: c.mobile,
          email: c.email,
          created_at: c.created_at,
        }),
      )
      .catch(() => undefined);
  }, [ready, preselectedClientId]);

  // Fetch the client's measurement history when we land on step 2.
  useEffect(() => {
    if (!client || step !== 2) return;
    let cancelled = false;
    setLoadingMeasurements(true);
    listMeasurements(client.id)
      .then((data) => {
        if (cancelled) return;
        setMeasurements(data.results);
        if (!measurementId && data.results[0]) {
          setMeasurementId(data.results[0].id);
        }
      })
      .finally(() => !cancelled && setLoadingMeasurements(false));
    return () => {
      cancelled = true;
    };
  }, [client, step, measurementId]);

  const subtotal = useMemo(() => {
    return lines.reduce((acc, l) => {
      const u = parseFloat(l.unit_price || '0');
      return acc + (Number.isFinite(u) ? u : 0) * l.quantity;
    }, 0);
  }, [lines]);

  if (!ready) return null;

  function canAdvance(): boolean {
    if (step === 0) return Boolean(client);
    if (step === 1)
      return lines.length > 0 && lines.every((l) => l.garment_type && l.quantity >= 1);
    return true;
  }

  async function onSubmit() {
    if (!client) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({
        client: client.id,
        measurement_set: measurementId,
        order_type: orderType,
        trial_date: trialDate || null,
        delivery_date: deliveryDate || null,
        advance: advance || 0,
        notes,
        line_items: lines.map((l, i) => ({
          garment_type: l.garment_type,
          fabric_description: l.fabric_description,
          fabric: l.fabric_id ?? undefined,
          meters_used: l.meters_used ? Number(l.meters_used) : 0,
          quantity: l.quantity,
          unit_price: l.unit_price || 0,
          customization_notes: l.customization_notes,
          position: i,
        })),
      });
      router.replace(`/orders/${order.id}?welcome=1`);
    } catch (e) {
      if (e instanceof ApiError && typeof e.data === 'object' && e.data) {
        const data = e.data as Record<string, unknown>;
        const flat = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join(' · ');
        setError(flat || e.message);
      } else {
        setError('Could not create the order.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            New order
          </p>
          <h1 className="font-display text-3xl gold-text">Create order</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="glass-panel p-5">
          <Stepper steps={STEPS} current={step} />
          <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-foreground/50">
            Order ID is generated on save · format
            <span className="ml-1 font-mono text-gold-300">VS-YYYYMMDD-XXXX</span>
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.section
                key="step-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="glass-panel p-6">
                  <h2 className="mb-4 font-display text-xl">Client</h2>
                  <ClientPicker selected={client} onSelect={setClient} />
                </div>

                <div className="glass-panel p-6">
                  <h2 className="mb-4 font-display text-xl">Order type</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(['full', 'alteration'] as OrderType[]).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                          orderType === t
                            ? 'border-gold-500/60 bg-gold-500/10 shadow-gold'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                        )}
                      >
                        <Receipt className="h-5 w-5 text-gold-400" />
                        <div>
                          <p className="font-medium">
                            {ORDER_TYPE_LABELS[t]}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground/50">
                            {t === 'full'
                              ? 'Full bespoke garment(s) — measurements, fabric, and full production cycle.'
                              : 'Alterations on garments not originally made here. Lighter flow.'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {step === 1 && (
              <motion.section
                key="step-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="glass-panel space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl">Garments</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLines((prev) => [...prev, { ...EMPTY_LINE }])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add line
                    </Button>
                  </div>

                  <ul className="space-y-3">
                    {lines.map((line, idx) => (
                      <li
                        key={idx}
                        className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[160px_1fr_120px_140px_40px]">
                          <select
                            value={line.garment_type}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, garment_type: e.target.value as GarmentType }
                                    : l,
                                ),
                              )
                            }
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60"
                          >
                            {GARMENT_OPTIONS.map((g) => (
                              <option key={g} value={g} className="bg-navy-700">
                                {GARMENT_LABELS[g]}
                              </option>
                            ))}
                          </select>
                          <input
                            value={line.fabric_description}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, fabric_description: e.target.value }
                                    : l,
                                ),
                              )
                            }
                            placeholder="Fabric (e.g. Italian wool, navy pinstripe)"
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60"
                          />
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-wider text-foreground/40">
                              Qty
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          quantity: Math.max(1, Number(e.target.value) || 1),
                                        }
                                      : l,
                                  ),
                                )
                              }
                              className="w-full bg-transparent text-sm tabular-nums outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                            <IndianRupee className="h-3.5 w-3.5 text-foreground/40" />
                            <input
                              type="number"
                              min={0}
                              step={50}
                              placeholder="Unit price"
                              value={line.unit_price}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? { ...l, unit_price: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                              className="w-full bg-transparent text-sm tabular-nums outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setLines((prev) =>
                                prev.length === 1
                                  ? prev
                                  : prev.filter((_, i) => i !== idx),
                              )
                            }
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-xl border text-xs',
                              lines.length === 1
                                ? 'cursor-not-allowed border-white/10 text-foreground/30'
                                : 'border-status-rejected/30 bg-status-rejected/10 text-red-200 hover:bg-status-rejected/20',
                            )}
                            disabled={lines.length === 1}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Inventory pick — links the line to a tracked fabric and deducts stock on save. */}
                        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                          <select
                            value={line.fabric_id ?? ''}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        fabric_id: e.target.value || null,
                                        meters_used:
                                          e.target.value ? l.meters_used : '',
                                      }
                                    : l,
                                ),
                              )
                            }
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60"
                          >
                            <option value="" className="bg-navy-700">
                              No tracked fabric (description above only)
                            </option>
                            {fabrics.map((f) => (
                              <option
                                key={f.id}
                                value={f.id}
                                className="bg-navy-700"
                              >
                                {`${f.code} · ${f.name} · ${Number(
                                  f.quantity_meters,
                                ).toFixed(1)} m in stock`}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-wider text-foreground/40">
                              Metres
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              disabled={!line.fabric_id}
                              value={line.meters_used}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? { ...l, meters_used: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                              placeholder="—"
                              className="w-full bg-transparent text-sm tabular-nums outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={line.customization_notes}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, customization_notes: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          placeholder="Customization notes (working buttonholes, monogram lining, slim taper…)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60"
                        />
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 text-sm">
                    <span className="text-foreground/50">Subtotal (auto)</span>
                    <span className="font-mono tabular-nums text-gold-300">
                      ₹ {subtotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.section>
            )}

            {step === 2 && (
              <motion.section
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="glass-panel p-6">
                  <h2 className="mb-3 font-display text-xl">Link a measurement set</h2>
                  <p className="mb-4 text-sm text-foreground/60">
                    Pick the measurement set for this visit. The PDF receipt and
                    the master tailor will reference these numbers.
                  </p>
                  {loadingMeasurements ? (
                    <div className="flex items-center gap-2 text-xs text-foreground/50">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
                      Loading measurement history…
                    </div>
                  ) : measurements.length === 0 ? (
                    <div className="rounded-xl border border-status-trial/40 bg-status-trial/10 p-4 text-sm">
                      <p className="text-amber-100">
                        No measurement sets exist for this client yet.
                      </p>
                      <Link
                        href={`/clients/${client?.id}/measurements/new`}
                        className="mt-2 inline-flex items-center gap-1 text-amber-200 hover:underline"
                      >
                        Capture measurements first
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {measurements.map((m) => {
                        const checked = measurementId === m.id;
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => setMeasurementId(m.id)}
                              className={cn(
                                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                                checked
                                  ? 'border-gold-500/60 bg-gold-500/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                              )}
                            >
                              <span
                                className={cn(
                                  'mt-1 flex h-4 w-4 items-center justify-center rounded-full border',
                                  checked
                                    ? 'border-gold-400 bg-gold-500'
                                    : 'border-white/20',
                                )}
                              >
                                {checked && <Check className="h-3 w-3 text-navy-700" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm">
                                  {new Date(m.created_at).toLocaleString(
                                    undefined,
                                    {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    },
                                  )}
                                </p>
                                <p className="text-xs text-foreground/50">
                                  {m.garment_count} item(s) ·{' '}
                                  {m.garment_types
                                    .map((g) => GARMENT_LABELS[g])
                                    .join(', ') || 'no garments tagged'}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="glass-panel p-6">
                  <h2 className="mb-3 font-display text-xl">Schedule & advance</h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      label="Trial date"
                      name="trial_date"
                      type="date"
                      icon={<Calendar className="h-4 w-4" />}
                      value={trialDate}
                      onChange={(e) => setTrialDate(e.target.value)}
                    />
                    <Input
                      label="Delivery date"
                      name="delivery_date"
                      type="date"
                      icon={<Calendar className="h-4 w-4" />}
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                    <Input
                      label="Advance paid"
                      name="advance"
                      type="number"
                      min={0}
                      step={50}
                      icon={<IndianRupee className="h-4 w-4" />}
                      value={advance}
                      onChange={(e) => setAdvance(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Internal notes
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything the master should know — preferences, deadlines, special handling…"
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
                    />
                  </div>
                </div>
              </motion.section>
            )}

            {step === 3 && (
              <motion.section
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-panel space-y-2 p-6"
              >
                <h2 className="mb-2 font-display text-xl">Review</h2>
                <Row label="Client" value={`${client?.full_name} · ${client?.client_id}`} />
                <Row label="Type" value={ORDER_TYPE_LABELS[orderType]} />
                <Row
                  label="Garments"
                  value={lines
                    .map(
                      (l) =>
                        `${l.quantity} × ${GARMENT_LABELS[l.garment_type]}` +
                        (l.fabric_description ? ` (${l.fabric_description})` : ''),
                    )
                    .join(', ')}
                />
                <Row label="Subtotal" value={`₹ ${subtotal.toLocaleString()}`} />
                {advance && (
                  <Row label="Advance" value={`₹ ${Number(advance).toLocaleString()}`} />
                )}
                {trialDate && <Row label="Trial date" value={trialDate} />}
                {deliveryDate && <Row label="Delivery date" value={deliveryDate} />}
                <Row
                  label="Measurement set"
                  value={
                    measurementId
                      ? measurements.find((m) => m.id === measurementId)?.created_at?.slice(0, 10) ||
                        'linked'
                      : '—'
                  }
                />

                {error && (
                  <p className="mt-3 rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
                    {error}
                  </p>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onSubmit} loading={submitting}>
                <Check className="h-4 w-4" />
                Create order
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wider text-foreground/40">
        {label}
      </span>
      <span className="ml-4 max-w-[60%] text-right text-foreground/80">
        {value}
      </span>
    </div>
  );
}
