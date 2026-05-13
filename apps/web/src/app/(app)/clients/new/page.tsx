'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PreferenceChips } from '@/components/clients/preference-chips';
import {
  EMPTY_FORM,
  MeasurementForm,
  type MeasurementFormState,
} from '@/components/measurement/measurement-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { clientByMobile, createClient } from '@/lib/clients';
import { createMeasurement } from '@/lib/measurements';
import {
  AGE_GROUP_LABELS,
  FABRIC_LABELS,
  OCCASION_LABELS,
  type AgeGroup,
  type Client,
  type FabricPreference,
  type Occasion,
} from '@versuitality/types';

const STEPS = [
  { key: 'contact', label: 'Contact', description: 'Identification' },
  { key: 'preferences', label: 'Preferences', description: 'Style notes' },
  { key: 'measurements', label: 'Measurements', description: 'Body details' },
  { key: 'review', label: 'Review', description: 'Confirm & save' },
];

interface ContactState {
  full_name: string;
  mobile: string;
  alt_mobile: string;
  email: string;
  address: string;
  age_group: AgeGroup | '';
}

const EMPTY_CONTACT: ContactState = {
  full_name: '',
  mobile: '',
  alt_mobile: '',
  email: '',
  address: '',
  age_group: '',
};

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = (
  Object.keys(AGE_GROUP_LABELS) as AgeGroup[]
).map((v) => ({ value: v, label: AGE_GROUP_LABELS[v] }));

const OCCASION_OPTIONS = (Object.keys(OCCASION_LABELS) as Occasion[]).map(
  (v) => ({ value: v, label: OCCASION_LABELS[v] }),
);

const FABRIC_OPTIONS = (Object.keys(FABRIC_LABELS) as FabricPreference[]).map(
  (v) => ({
  value: v,
  label: FABRIC_LABELS[v],
  }),
);

export default function NewClientPage() {
  const router = useRouter();
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });

  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [fabrics, setFabrics] = useState<FabricPreference[]>([]);
  const [notes, setNotes] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementFormState>(EMPTY_FORM);

  const [returningClient, setReturningClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returning-client detection: query as the staff finishes typing the mobile.
  useEffect(() => {
    const m = contact.mobile.replace(/\D+/g, '');
    if (m.length < 7) {
      setReturningClient(null);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      clientByMobile(contact.mobile)
        .then((c) => {
          if (!cancelled) setReturningClient(c);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [contact.mobile]);

  if (!ready) return null;

  function canAdvance(): boolean {
    if (step === 0) {
      return Boolean(contact.full_name.trim() && contact.mobile.trim().length >= 7);
    }
    if (step === 1) return true;
    if (step === 2) {
      return measurements.garment_types.length > 0;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const client = await createClient({
        full_name: contact.full_name.trim(),
        mobile: contact.mobile,
        alt_mobile: contact.alt_mobile,
        email: contact.email,
        address: contact.address,
        age_group: contact.age_group || undefined,
        occasion_preferences: occasions,
        fabric_preferences: fabrics,
        notes,
      });

      // Build the measurement payload
      const numericKeys = Object.entries(measurements.values).reduce(
        (acc, [k, v]) => {
          if (v !== '' && v !== undefined && v !== null) acc[k] = String(v);
          return acc;
        },
        {} as Record<string, string>,
      );

      await createMeasurement({
        client: client.id,
        garment_types: measurements.garment_types,
        garment_count: measurements.garment_count,
        suit_lapel_style: measurements.suit_lapel_style,
        suit_button_stance: measurements.suit_button_stance,
        suit_vent: measurements.suit_vent,
        fabric_details: measurements.fabric_details,
        customization_notes: measurements.customization_notes,
        cloth_image_file: measurements.cloth_image_file,
        ...numericKeys,
      });

      router.replace(`/clients/${client.id}?welcome=1`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (typeof err.data === 'object' && err.data) {
          const data = err.data as Record<string, unknown>;
          const fieldErrors = Object.entries(data)
            .map(([k, v]) => {
              const msg = Array.isArray(v) ? v[0] : v;
              return `${k}: ${msg}`;
            })
            .join('  ·  ');
          setError(fieldErrors || err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('Could not save the client. Please try again.');
      }
    } finally {
      setSubmitting(false);
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
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            New intake
          </p>
          <h1 className="font-display text-3xl gold-text">Register a client</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="glass-panel p-5">
          <Stepper steps={STEPS} current={step} />
          {returningClient && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 rounded-xl border border-status-trial/40 bg-status-trial/10 p-3 text-xs"
            >
              <p className="font-medium text-amber-200">Returning client</p>
              <p className="mt-0.5 text-foreground/70">
                {returningClient.full_name} · {returningClient.client_id}
              </p>
              <Link
                href={`/clients/${returningClient.id}`}
                className="mt-2 inline-flex items-center gap-1 text-amber-200 hover:underline"
              >
                Open profile
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          )}
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.section
                key="step-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-panel p-6"
              >
                <h2 className="mb-4 font-display text-xl">Contact details</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Full name"
                    name="full_name"
                    icon={<UserCircle2 className="h-4 w-4" />}
                    value={contact.full_name}
                    onChange={(e) =>
                      setContact({ ...contact, full_name: e.target.value })
                    }
                    required
                    placeholder="Aarav Mehta"
                  />
                  <Input
                    label="Mobile (WhatsApp)"
                    name="mobile"
                    type="tel"
                    icon={<Phone className="h-4 w-4" />}
                    value={contact.mobile}
                    onChange={(e) =>
                      setContact({ ...contact, mobile: e.target.value })
                    }
                    required
                    placeholder="+91 98765 43210"
                    hint="Primary identifier · used for status notifications"
                  />
                  <Input
                    label="Alternate number"
                    name="alt_mobile"
                    type="tel"
                    icon={<Phone className="h-4 w-4" />}
                    value={contact.alt_mobile}
                    onChange={(e) =>
                      setContact({ ...contact, alt_mobile: e.target.value })
                    }
                    placeholder="optional"
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    icon={<Mail className="h-4 w-4" />}
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                    placeholder="optional"
                  />
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground/40" />
                      <textarea
                        rows={2}
                        value={contact.address}
                        onChange={(e) =>
                          setContact({ ...contact, address: e.target.value })
                        }
                        placeholder="House, street, city — optional"
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Age group
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AGE_OPTIONS.map((o) => {
                        const active = contact.age_group === o.value;
                        return (
                          <button
                            type="button"
                            key={o.value}
                            onClick={() =>
                              setContact({
                                ...contact,
                                age_group: active ? '' : o.value,
                              })
                            }
                            className={
                              'rounded-full border px-3 py-1.5 text-xs transition-all ' +
                              (active
                                ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                                : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20')
                            }
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
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
                className="glass-panel p-6"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold-400" />
                  <h2 className="font-display text-xl">Style preferences</h2>
                </div>
                <p className="mb-5 text-sm text-foreground/60">
                  These guide product recommendations and seasonal outreach.
                  All optional.
                </p>

                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Occasions
                    </p>
                    <PreferenceChips
                      options={OCCASION_OPTIONS}
                      value={occasions}
                      onChange={setOccasions}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Fabrics
                    </p>
                    <PreferenceChips
                      options={FABRIC_OPTIONS}
                      value={fabrics}
                      onChange={setFabrics}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Internal notes
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Right shoulder slightly higher, prefers slim tapered fits…"
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
                    />
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
              >
                <div className="mb-4 flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-gold-400" />
                  <h2 className="font-display text-xl">Measurements</h2>
                </div>
                <MeasurementForm
                  state={measurements}
                  onChange={setMeasurements}
                />
              </motion.section>
            )}

            {step === 3 && (
              <motion.section
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-panel p-6"
              >
                <h2 className="mb-4 font-display text-xl">Confirm & save</h2>
                <ReviewBlock label="Name" value={contact.full_name} />
                <ReviewBlock label="Mobile" value={contact.mobile} />
                {contact.email && <ReviewBlock label="Email" value={contact.email} />}
                {contact.address && (
                  <ReviewBlock label="Address" value={contact.address} />
                )}
                {contact.age_group && (
                  <ReviewBlock
                    label="Age group"
                    value={AGE_GROUP_LABELS[contact.age_group as AgeGroup]}
                  />
                )}
                {occasions.length > 0 && (
                  <ReviewBlock
                    label="Occasions"
                    value={occasions.map((o) => OCCASION_LABELS[o]).join(', ')}
                  />
                )}
                {fabrics.length > 0 && (
                  <ReviewBlock
                    label="Fabrics"
                    value={fabrics.map((f) => FABRIC_LABELS[f]).join(', ')}
                  />
                )}
                <ReviewBlock
                  label="Garments"
                  value={
                    measurements.garment_types.length
                      ? `${measurements.garment_count} item(s) — ${measurements.garment_types.join(', ')}`
                      : '—'
                  }
                />
                <ReviewBlock
                  label="Measurement points captured"
                  value={String(
                    Object.values(measurements.values).filter(
                      (v) => v !== '' && v != null,
                    ).length,
                  )}
                />
                {measurements.cloth_image_file && (
                  <ReviewBlock
                    label="Cloth image"
                    value={`${measurements.cloth_image_file.name} (${Math.round(measurements.cloth_image_file.size / 1024)} KB)`}
                  />
                )}
                {error && (
                  <p className="mt-4 rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
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
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting}>
                <Check className="h-4 w-4" />
                Save client & measurements
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
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
