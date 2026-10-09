'use client';

import { ArrowLeft, Calendar, IndianRupee, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { StatusBadge } from '@/components/orders/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { listFabrics } from '@/lib/inventory';
import { listMeasurements } from '@/lib/measurements';
import { getOrder, updateOrder, type OrderUpdatePayload } from '@/lib/orders';
import {
  GARMENT_LABELS,
  type Fabric,
  type GarmentType,
  type MeasurementSet,
  type Order,
} from '@versuitality/types';

const GARMENTS = Object.keys(GARMENT_LABELS) as GarmentType[];

interface DraftLine {
  garment_type: GarmentType;
  fabric_description: string;
  fabric_id: string;
  meters_used: string;
  quantity: number;
  unit_price: string;
  customization_notes: string;
}

const selectCls =
  'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60';

export default function EditOrderPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementSet[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [trialDate, setTrialDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getOrder(params.id)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setTrialDate(o.trial_date ?? '');
        setDeliveryDate(o.delivery_date ?? '');
        setAdvance(String(Number(o.advance)));
        setNotes(o.notes ?? '');
        setMeasurementId(o.measurement_set ?? '');
        setLines(
          o.line_items.map((l) => ({
            garment_type: l.garment_type,
            fabric_description: l.fabric_description ?? '',
            fabric_id: l.fabric ?? '',
            meters_used: l.meters_used && Number(l.meters_used) > 0 ? String(Number(l.meters_used)) : '',
            quantity: l.quantity,
            unit_price: String(Number(l.unit_price)),
            customization_notes: l.customization_notes ?? '',
          })),
        );
        listMeasurements(o.client.id).then((m) => !cancelled && setMeasurements(m.results)).catch(() => undefined);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    listFabrics({ active: true })
      .then((f) => !cancelled && setFabrics(f.results))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, params.id]);

  const garmentsEditable = order?.status === 'order_received' || order?.status === 'requirements_noted';
  const delivered = order?.status === 'delivered';

  const subtotal = useMemo(
    () =>
      garmentsEditable
        ? lines.reduce((sum, l) => sum + (Number(l.unit_price) || 0) * (l.quantity || 1), 0)
        : Number(order?.subtotal ?? 0),
    [garmentsEditable, lines, order?.subtotal],
  );

  function patchLine(idx: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function onSave() {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      const payload: OrderUpdatePayload = { advance: advance || 0, notes };
      if (!delivered) {
        payload.trial_date = trialDate || null;
        payload.delivery_date = deliveryDate || null;
        payload.measurement_set = measurementId || null;
      }
      if (garmentsEditable) {
        payload.line_items = lines.map((l) => ({
          garment_type: l.garment_type,
          fabric_description: l.fabric_description,
          fabric: l.fabric_id || null,
          meters_used: l.fabric_id && l.meters_used ? Number(l.meters_used) : 0,
          quantity: l.quantity,
          unit_price: l.unit_price || 0,
          customization_notes: l.customization_notes,
        }));
      }
      await updateOrder(order.id, payload);
      router.replace(`/orders/${order.id}?edited=1`);
    } catch (e) {
      if (e instanceof ApiError && e.data && typeof e.data === 'object') {
        const flat = Object.entries(e.data as Record<string, unknown>)
          .map(([k, v]) => `${k === 'detail' ? '' : `${k}: `}${Array.isArray(v) ? v[0] : String(v)}`)
          .join(' · ');
        setError(flat || e.message);
      } else {
        setError('Could not save the changes.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        {error ? (
          <p className="text-sm text-red-200">{error}</p>
        ) : (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
        )}
      </div>
    );
  }
  if (order.status === 'cancelled') {
    return (
      <div className="glass-panel mx-auto max-w-lg space-y-3 p-8 text-center">
        <p className="font-display text-xl">This order was cancelled</p>
        <p className="text-sm text-foreground/50">Cancelled orders cannot be edited.</p>
        <Link href={`/orders/${order.id}`}>
          <Button variant="secondary">Back to the order</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/orders/${order.id}`}
          aria-label="Back to the order"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-gold-300/80">{order.order_id}</p>
          <h1 className="font-display text-3xl gold-text">Edit order</h1>
        </div>
        <div className="ml-auto">
          <StatusBadge status={order.status} size="md" />
        </div>
      </div>

      <p className="text-sm text-foreground/55">
        {garmentsEditable
          ? 'Nothing has been cut yet, so garments, prices, dates and payment can all be changed.'
          : delivered
            ? 'This order is delivered — you can still record payments and notes.'
            : 'Cutting has started, so garments are locked. Dates, payment, notes and measurements can still change.'}
      </p>

      {garmentsEditable && (
        <section className="glass-panel space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Garments</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { garment_type: 'shirt', fabric_description: '', fabric_id: '', meters_used: '', quantity: 1, unit_price: '', customization_notes: '' },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </div>
          <ul className="space-y-3">
            {lines.map((line, idx) => (
              <li key={idx} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-3 md:grid-cols-[160px_1fr_120px_140px_40px]">
                  <select
                    aria-label="Garment"
                    value={line.garment_type}
                    onChange={(e) => patchLine(idx, { garment_type: e.target.value as GarmentType })}
                    className={selectCls}
                  >
                    {GARMENTS.map((g) => (
                      <option key={g} value={g} className="bg-navy-700">
                        {GARMENT_LABELS[g]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Fabric description"
                    value={line.fabric_description}
                    onChange={(e) => patchLine(idx, { fabric_description: e.target.value })}
                    placeholder="Fabric (e.g. Italian wool, navy pinstripe)"
                    className={`${selectCls} placeholder:text-foreground/30`}
                  />
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-foreground/40">Qty</span>
                    <input
                      aria-label="Quantity"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => patchLine(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-full bg-transparent text-sm tabular-nums outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <IndianRupee className="h-3.5 w-3.5 text-foreground/40" />
                    <input
                      aria-label="Unit price"
                      type="number"
                      min={0}
                      step={50}
                      placeholder="Unit price"
                      value={line.unit_price}
                      onChange={(e) => patchLine(idx, { unit_price: e.target.value })}
                      className="w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-foreground/30"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-status-rejected/30 bg-status-rejected/10 text-red-200 hover:bg-status-rejected/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                  <select
                    aria-label="Tracked fabric"
                    value={line.fabric_id}
                    onChange={(e) => patchLine(idx, { fabric_id: e.target.value, meters_used: e.target.value ? line.meters_used : '' })}
                    className={selectCls}
                  >
                    <option value="" className="bg-navy-700">
                      No tracked fabric (description above only)
                    </option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id} className="bg-navy-700">
                        {`${f.code} · ${f.name} · ${Number(f.quantity_meters).toFixed(1)} m in stock`}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-foreground/40">Metres</span>
                    <input
                      aria-label="Metres used"
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={!line.fabric_id}
                      value={line.meters_used}
                      onChange={(e) => patchLine(idx, { meters_used: e.target.value })}
                      placeholder="—"
                      className="w-full bg-transparent text-sm tabular-nums outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
                <textarea
                  aria-label="Customization notes"
                  rows={2}
                  value={line.customization_notes}
                  onChange={(e) => patchLine(idx, { customization_notes: e.target.value })}
                  placeholder="Customization notes"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60"
                />
              </li>
            ))}
          </ul>
          <p className="text-right text-sm text-foreground/60">
            New total <span className="ml-2 font-mono text-gold-200">₹ {subtotal.toLocaleString()}</span>
          </p>
        </section>
      )}

      {!delivered && measurements.length > 0 && (
        <section className="glass-panel p-6">
          <h2 className="mb-3 font-display text-xl">Measurement set</h2>
          <select
            aria-label="Measurement set"
            value={measurementId}
            onChange={(e) => setMeasurementId(e.target.value)}
            className={`${selectCls} w-full`}
          >
            <option value="" className="bg-navy-700">
              None linked
            </option>
            {measurements.map((m) => (
              <option key={m.id} value={m.id} className="bg-navy-700">
                {new Date(m.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                {m.garment_types?.length ? ` · ${m.garment_types.join(', ')}` : ''}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="glass-panel p-6">
        <h2 className="mb-3 font-display text-xl">Schedule &amp; payment</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {!delivered && (
            <>
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
            </>
          )}
          <Input
            label="Paid so far (advance)"
            name="advance"
            type="number"
            min={0}
            icon={<IndianRupee className="h-4 w-4" />}
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
            hint={`Balance after saving: ₹ ${Math.max(0, subtotal - (Number(advance) || 0)).toLocaleString()}`}
          />
        </div>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-foreground/60" htmlFor="order-notes">
          Notes
        </label>
        <textarea
          id="order-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the master should know — preferences, deadlines, special handling…"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
        />
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href={`/orders/${order.id}`}>
          <Button variant="ghost">Discard changes</Button>
        </Link>
        <Button onClick={onSave} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
