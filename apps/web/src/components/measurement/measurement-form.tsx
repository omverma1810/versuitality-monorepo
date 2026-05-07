'use client';

import { Image as ImageIcon, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Silhouette } from '@/components/measurement/silhouette';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  GARMENT_LABELS,
  type ButtonStance,
  type GarmentType,
  type LapelStyle,
  type MeasurementKey,
  type VentStyle,
} from '@versuitality/types';

export interface MeasurementFormState {
  garment_types: GarmentType[];
  garment_count: number;
  values: Partial<Record<MeasurementKey, string>>;
  suit_lapel_style: LapelStyle;
  suit_button_stance: ButtonStance;
  suit_vent: VentStyle;
  fabric_details: string;
  customization_notes: string;
  cloth_image_file: File | null;
}

export const EMPTY_FORM: MeasurementFormState = {
  garment_types: [],
  garment_count: 1,
  values: {},
  suit_lapel_style: '',
  suit_button_stance: '',
  suit_vent: '',
  fabric_details: '',
  customization_notes: '',
  cloth_image_file: null,
};

const UPPER: { key: MeasurementKey; label: string }[] = [
  { key: 'upper_length', label: 'Length' },
  { key: 'upper_shoulder', label: 'Shoulder' },
  { key: 'upper_sleeve', label: 'Sleeve' },
  { key: 'upper_half_sleeve', label: '½ Sleeve' },
  { key: 'upper_chest', label: 'Chest' },
  { key: 'upper_waist', label: 'Waist' },
  { key: 'upper_hip', label: 'Hip' },
  { key: 'upper_cuff', label: 'Cuff' },
  { key: 'upper_collar', label: 'Collar' },
  { key: 'upper_arms', label: 'Arms' },
];

const LOWER: { key: MeasurementKey; label: string }[] = [
  { key: 'lower_length', label: 'Length' },
  { key: 'lower_bottom', label: 'Bottom' },
  { key: 'lower_knee', label: 'Knee' },
  { key: 'lower_waist', label: 'Waist' },
  { key: 'lower_hip', label: 'Hip' },
  { key: 'lower_seat_round', label: 'Seat round' },
  { key: 'lower_inseam', label: 'Inseam' },
  { key: 'lower_thigh', label: 'Thigh' },
];

const GARMENTS: GarmentType[] = [
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

const LAPEL_OPTIONS: { value: LapelStyle; label: string }[] = [
  { value: '', label: '—' },
  { value: 'notch', label: 'Notch' },
  { value: 'peak', label: 'Peak' },
  { value: 'shawl', label: 'Shawl' },
];

const BUTTON_OPTIONS: { value: ButtonStance; label: string }[] = [
  { value: '', label: '—' },
  { value: 'single_1', label: 'Single · 1' },
  { value: 'single_2', label: 'Single · 2' },
  { value: 'single_3', label: 'Single · 3' },
  { value: 'double_4', label: 'Double · 4' },
  { value: 'double_6', label: 'Double · 6' },
];

const VENT_OPTIONS: { value: VentStyle; label: string }[] = [
  { value: '', label: '—' },
  { value: 'no_vent', label: 'No vent' },
  { value: 'center', label: 'Center vent' },
  { value: 'double', label: 'Side vents' },
];

interface Props {
  state: MeasurementFormState;
  onChange: (next: MeasurementFormState) => void;
}

export function MeasurementForm({ state, onChange }: Props) {
  const [active, setActive] = useState<MeasurementKey | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setValue = (k: MeasurementKey, v: string) =>
    onChange({ ...state, values: { ...state.values, [k]: v } });

  const toggleGarment = (g: GarmentType) =>
    onChange({
      ...state,
      garment_types: state.garment_types.includes(g)
        ? state.garment_types.filter((x) => x !== g)
        : [...state.garment_types, g],
    });

  const showSuit = state.garment_types.some((g) =>
    ['suit', 'blazer', 'sherwani'].includes(g),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Inputs */}
      <div className="space-y-6">
        {/* Garment selection */}
        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg">Garments</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">Total count</span>
              <input
                type="number"
                min={1}
                max={50}
                value={state.garment_count}
                onChange={(e) =>
                  onChange({
                    ...state,
                    garment_count: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="h-8 w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-center text-sm outline-none focus:border-gold-500/40"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {GARMENTS.map((g) => {
              const active = state.garment_types.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggleGarment(g)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-all',
                    active
                      ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                      : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
                  )}
                >
                  {GARMENT_LABELS[g]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upper measurements */}
        <Section title="Upper" subtitle="Shirt · Kurta · Blazer (in inches, ½″ precision)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {UPPER.map((f) => (
              <NumberField
                key={f.key}
                k={f.key}
                label={f.label}
                value={state.values[f.key] ?? ''}
                onChange={setValue}
                onFocusKey={setActive}
              />
            ))}
          </div>
        </Section>

        {/* Lower measurements */}
        <Section title="Lower" subtitle="Trouser · Pant (in inches, ½″ precision)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {LOWER.map((f) => (
              <NumberField
                key={f.key}
                k={f.key}
                label={f.label}
                value={state.values[f.key] ?? ''}
                onChange={setValue}
                onFocusKey={setActive}
              />
            ))}
          </div>
        </Section>

        {/* Suit specifics — only when relevant */}
        {showSuit && (
          <Section title="Suit / Blazer" subtitle="Style choices for tailored suiting">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField
                label="Lapel"
                value={state.suit_lapel_style}
                options={LAPEL_OPTIONS}
                onChange={(v) =>
                  onChange({ ...state, suit_lapel_style: v as LapelStyle })
                }
              />
              <SelectField
                label="Button stance"
                value={state.suit_button_stance}
                options={BUTTON_OPTIONS}
                onChange={(v) =>
                  onChange({ ...state, suit_button_stance: v as ButtonStance })
                }
              />
              <SelectField
                label="Vent"
                value={state.suit_vent}
                options={VENT_OPTIONS}
                onChange={(v) => onChange({ ...state, suit_vent: v as VentStyle })}
              />
            </div>
          </Section>
        )}

        {/* Fabric + cloth image */}
        <Section title="Fabric & cloth" subtitle="Photograph the swatch and capture nuances">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                Cloth image
              </label>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-xs text-foreground/50 transition-colors hover:border-gold-500/50 hover:bg-white/[0.05] hover:text-foreground"
              >
                {state.cloth_image_file ? (
                  <span className="flex flex-col items-center gap-1 text-foreground">
                    <ImageIcon className="h-5 w-5 text-gold-400" />
                    {state.cloth_image_file.name}
                    <span className="text-[10px] text-foreground/50">
                      ({Math.round(state.cloth_image_file.size / 1024)} KB) — click to replace
                    </span>
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5" />
                    Click to upload (JPG / PNG)
                  </span>
                )}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  onChange({
                    ...state,
                    cloth_image_file: e.target.files?.[0] ?? null,
                  })
                }
              />
            </div>
            <div className="space-y-3">
              <Input
                label="Fabric details"
                placeholder="Italian wool, navy pinstripe, 280 GSM"
                value={state.fabric_details}
                onChange={(e) =>
                  onChange({ ...state, fabric_details: e.target.value })
                }
              />
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                  Customization notes
                </label>
                <textarea
                  rows={3}
                  value={state.customization_notes}
                  placeholder="Working buttonholes on cuffs, monogrammed lining…"
                  onChange={(e) =>
                    onChange({
                      ...state,
                      customization_notes: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none transition-colors placeholder:text-foreground/30 focus:border-gold-500/60 focus:bg-white/10"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Silhouette reference (sticky) */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="glass-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm uppercase tracking-wider text-foreground/70">
              Reference
            </h3>
            <span className="text-[10px] text-foreground/40">
              focus a field to highlight
            </span>
          </div>
          <Silhouette active={active} />
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="mb-4">
        <h3 className="font-display text-lg">{title}</h3>
        {subtitle && (
          <p className="text-xs text-foreground/50">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function NumberField({
  k,
  label,
  value,
  onChange,
  onFocusKey,
}: {
  k: MeasurementKey;
  label: string;
  value: string;
  onChange: (k: MeasurementKey, v: string) => void;
  onFocusKey: (k: MeasurementKey | null) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 transition-colors focus-within:border-gold-500/60 focus-within:bg-white/10">
        <input
          type="number"
          step="0.5"
          min="0"
          max="120"
          value={value}
          inputMode="decimal"
          onChange={(e) => onChange(k, e.target.value)}
          onFocus={() => onFocusKey(k)}
          onBlur={() => onFocusKey(null)}
          className="w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-foreground/30"
          placeholder="—"
        />
        <span className="ml-1 text-[10px] text-foreground/40">in</span>
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-foreground/60">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-gold-500/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-navy-700">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
