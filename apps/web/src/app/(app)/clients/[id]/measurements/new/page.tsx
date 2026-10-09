'use client';

import { ArrowLeft, Check, Ruler } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  EMPTY_FORM,
  MeasurementForm,
  type MeasurementFormState,
} from '@/components/measurement/measurement-form';
import { Button } from '@/components/ui/button';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { getClient, getClientProfile } from '@/lib/clients';
import { createMeasurement } from '@/lib/measurements';
import { MEASUREMENT_KEYS, type Client, type MeasurementKey, type MeasurementSet } from '@versuitality/types';

/** Only same-site paths are honoured as a return target. */
function safeReturnTo(raw: string | null): string | null {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

function fromSet(m: MeasurementSet): MeasurementFormState {
  const values: Partial<Record<MeasurementKey, string>> = {};
  for (const k of MEASUREMENT_KEYS) {
    const v = m[k];
    if (v !== undefined && v !== null && v !== '') values[k] = String(Number(v));
  }
  return {
    ...EMPTY_FORM,
    garment_types: m.garment_types ?? [],
    garment_count: m.garment_count || 1,
    values,
    suit_lapel_style: m.suit_lapel_style ?? '',
    suit_button_stance: m.suit_button_stance ?? '',
    suit_vent: m.suit_vent ?? '',
    fabric_details: m.fabric_details ?? '',
    customization_notes: m.customization_notes ?? '',
  };
}

export default function NewMeasurementPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = safeReturnTo(search.get('returnTo'));

  const [client, setClient] = useState<Client | null>(null);
  const [state, setState] = useState<MeasurementFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    getClient(params.id as string)
      .then(setClient)
      .catch((e: Error) => setError(e.message));
    // Returning client: start from their last visit so only what changed needs typing.
    getClientProfile(params.id as string)
      .then((p) => {
        if (p.latest_measurement) {
          setState(fromSet(p.latest_measurement));
          setPrefilledFrom(p.latest_measurement.created_at);
        }
      })
      .catch(() => undefined);
  }, [ready, params.id]);

  if (!ready || !client) return null;

  async function onSave() {
    setSubmitting(true);
    setError(null);
    try {
      const numericKeys = Object.entries(state.values).reduce(
        (acc, [k, v]) => {
          if (v !== '' && v !== undefined && v !== null) acc[k] = String(v);
          return acc;
        },
        {} as Record<string, string>,
      );
      await createMeasurement({
        client: (params.id as string),
        garment_types: state.garment_types,
        garment_count: state.garment_count,
        suit_lapel_style: state.suit_lapel_style,
        suit_button_stance: state.suit_button_stance,
        suit_vent: state.suit_vent,
        fabric_details: state.fabric_details,
        customization_notes: state.customization_notes,
        cloth_image_file: state.cloth_image_file,
        ...numericKeys,
      });
      router.replace((returnTo ?? `/clients/${params.id}?welcome=1`) as never);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Could not save measurements.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/clients/${params.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            New measurement set
          </p>
          <h1 className="font-display text-3xl gold-text">{client.full_name}</h1>
          <p className="text-xs text-foreground/50">
            {client.client_id} · {client.mobile}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground/60">
        <Ruler className="h-4 w-4 text-gold-400" />
        Capturing a new measurement set links it to this client and is
        timestamped — every visit&apos;s history is preserved.
      </div>
      {prefilledFrom && (
        <p
          role="status"
          className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-2.5 text-sm text-gold-100"
        >
          Pre-filled from the visit on{' '}
          {new Date(prefilledFrom).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}.
          Change only what is different today — the earlier set stays on record.
        </p>
      )}

      <MeasurementForm state={state} onChange={setState} />

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onSave}
          loading={submitting}
          disabled={state.garment_types.length === 0}
        >
          <Check className="h-4 w-4" />
          Save measurement set
        </Button>
      </div>
    </div>
  );
}
