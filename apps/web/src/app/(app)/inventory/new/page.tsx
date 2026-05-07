'use client';

import { ArrowLeft, Boxes, Check, IndianRupee } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError } from '@/lib/api';
import { createFabric } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import { FABRIC_PATTERN_LABELS, type FabricPattern } from '@versuitality/types';

const PATTERNS: FabricPattern[] = ['solid', 'stripe', 'check', 'print', 'textured', 'other'];

export default function NewFabricPage() {
  const { ready } = useAuthGate({ roles: ['admin', 'staff'] });
  const router = useRouter();

  const [name, setName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [color, setColor] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [pattern, setPattern] = useState<FabricPattern>('solid');
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  const canSubmit = name.trim().length > 0 && quantity !== '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fabric = await createFabric({
        name: name.trim(),
        supplier,
        color,
        pattern,
        fabric_type: fabricType,
        quantity_meters: quantity || 0,
        low_stock_threshold: threshold || 0,
        cost_per_meter: cost || 0,
        price_per_meter: price || 0,
        notes,
        image_url: imageUrl,
      });
      router.replace(`/inventory/${fabric.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Could not save the fabric.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Inventory
          </p>
          <h1 className="font-display text-3xl gold-text">Add fabric</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="glass-panel space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-gold-400" />
            <h2 className="font-display text-lg">Identity</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Italian wool — navy pinstripe"
            />
            <Input
              label="Supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Reda · Loro Piana · …"
            />
            <Input
              label="Colour"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Navy"
            />
            <Input
              label="Type"
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
              placeholder="Wool · Cotton · Linen"
            />
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
                Pattern
              </label>
              <div className="flex flex-wrap gap-2">
                {PATTERNS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPattern(p)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-all',
                      pattern === p
                        ? 'border-gold-500/60 bg-gold-500/15 text-gold-200 shadow-gold'
                        : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
                    )}
                  >
                    {FABRIC_PATTERN_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel space-y-4 p-6">
          <h2 className="font-display text-lg">Stock & pricing</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              label="Opening stock (m)"
              required
              type="number"
              step="0.1"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Low-stock threshold"
              type="number"
              step="0.5"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
            <Input
              label="Cost / metre"
              type="number"
              step="50"
              min="0"
              icon={<IndianRupee className="h-4 w-4" />}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Price / metre"
              type="number"
              step="50"
              min="0"
              icon={<IndianRupee className="h-4 w-4" />}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
        </section>

        <section className="glass-panel space-y-4 p-6">
          <h2 className="font-display text-lg">Notes & image</h2>
          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="optional"
          />
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/60">
              Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the master should know — composition, weight, suitable garments…"
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
            Save fabric
          </Button>
        </div>
      </form>
    </div>
  );
}
