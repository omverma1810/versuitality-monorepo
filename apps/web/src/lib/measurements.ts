import type {
  MeasurementSet,
  PaginatedResponse,
} from '@versuitality/types';

import { api } from './api';

export async function listMeasurements(
  clientId: string,
): Promise<PaginatedResponse<MeasurementSet>> {
  return api<PaginatedResponse<MeasurementSet>>(
    `/api/measurements/?client=${clientId}&limit=100`,
  );
}

export interface MeasurementCreatePayload
  extends Partial<Omit<MeasurementSet, 'id' | 'created_at' | 'created_by'>> {
  client: string;
  cloth_image_file?: File | null;
}

export async function createMeasurement(
  payload: MeasurementCreatePayload,
): Promise<MeasurementSet> {
  const { cloth_image_file, garment_types, ...rest } = payload;
  if (cloth_image_file) {
    const fd = new FormData();
    Object.entries(rest).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      fd.append(k, String(v));
    });
    if (garment_types && garment_types.length) {
      fd.append('garment_types', JSON.stringify(garment_types));
    }
    fd.append('cloth_image', cloth_image_file);
    return api<MeasurementSet>('/api/measurements/', {
      method: 'POST',
      body: fd,
    });
  }
  return api<MeasurementSet>('/api/measurements/', {
    method: 'POST',
    body: { ...rest, garment_types: garment_types ?? [] },
  });
}
