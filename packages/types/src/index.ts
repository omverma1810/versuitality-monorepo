// Cross-package shared types. Domain types are added phase-by-phase as the
// API contracts solidify; this file deliberately starts small.

export type Role = 'admin' | 'staff' | 'master' | 'qa' | 'accountant';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Staff',
  master: 'Master',
  qa: 'QA',
  accountant: 'Accountant',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Owner — full access, finance, analytics',
  staff: 'Front Desk — CRM, measurements, orders',
  master: 'Head Tailor — production status owner',
  qa: 'Quality Assurance — checklist + pass/fail',
  accountant: 'Accountant — read-only, exports',
};

export type OrderStatus =
  | 'order_received'
  | 'requirements_noted'
  | 'cutting_started'
  | 'stitching_in_progress'
  | 'ready_for_trial'
  | 'alteration_in_progress'
  | 'ready_for_qc'
  | 'qc_rejected'
  | 'ready_for_delivery'
  | 'delivered';

export interface ApiHealth {
  status: 'ok';
  service: string;
  time: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  is_superuser?: boolean;
  last_login?: string | null;
  created_at?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface InviteLookup {
  email: string;
  full_name: string;
  role: Role;
  expires_at: string;
}

export interface InvitePayload {
  user: User;
  invite: {
    token: string;
    expires_at: string;
    setup_url: string;
  };
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

export type AgeGroup = 'under_25' | '25_34' | '35_44' | '45_54' | '55_plus';

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  under_25: 'Under 25',
  '25_34': '25 – 34',
  '35_44': '35 – 44',
  '45_54': '45 – 54',
  '55_plus': '55+',
};

export type Occasion =
  | 'wedding'
  | 'formal'
  | 'business'
  | 'casual'
  | 'festive'
  | 'ethnic';

export const OCCASION_LABELS: Record<Occasion, string> = {
  wedding: 'Wedding',
  formal: 'Formal',
  business: 'Business',
  casual: 'Casual',
  festive: 'Festive',
  ethnic: 'Ethnic',
};

export type Fabric =
  | 'cotton'
  | 'linen'
  | 'wool'
  | 'silk'
  | 'polyester_blend'
  | 'denim'
  | 'velvet'
  | 'tweed';

export const FABRIC_LABELS: Record<Fabric, string> = {
  cotton: 'Cotton',
  linen: 'Linen',
  wool: 'Wool',
  silk: 'Silk',
  polyester_blend: 'Poly-blend',
  denim: 'Denim',
  velvet: 'Velvet',
  tweed: 'Tweed',
};

export interface Client {
  id: string;
  client_id: string;
  full_name: string;
  mobile: string;
  alt_mobile?: string;
  email?: string;
  address?: string;
  age_group?: AgeGroup | '';
  occasion_preferences: Occasion[];
  fabric_preferences: Fabric[];
  notes?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
  measurement_count?: number;
  last_measurement_at?: string | null;
  order_count?: number;
}

export interface ClientSummary {
  id: string;
  client_id: string;
  full_name: string;
  mobile: string;
  email?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Measurements (digital twin of the paper slip)
// ---------------------------------------------------------------------------

export type GarmentType =
  | 'shirt'
  | 'kurta'
  | 'trouser'
  | 'pant'
  | 'suit'
  | 'blazer'
  | 'sherwani'
  | 'waistcoat'
  | 'jodhpuri';

export const GARMENT_LABELS: Record<GarmentType, string> = {
  shirt: 'Shirt',
  kurta: 'Kurta',
  trouser: 'Trouser',
  pant: 'Pant',
  suit: 'Suit',
  blazer: 'Blazer',
  sherwani: 'Sherwani',
  waistcoat: 'Waistcoat',
  jodhpuri: 'Jodhpuri',
};

export type LapelStyle = '' | 'notch' | 'peak' | 'shawl';
export type ButtonStance =
  | ''
  | 'single_1'
  | 'single_2'
  | 'single_3'
  | 'double_4'
  | 'double_6';
export type VentStyle = '' | 'no_vent' | 'center' | 'double';

export type MeasurementKey =
  | 'upper_length'
  | 'upper_shoulder'
  | 'upper_sleeve'
  | 'upper_half_sleeve'
  | 'upper_chest'
  | 'upper_waist'
  | 'upper_hip'
  | 'upper_cuff'
  | 'upper_collar'
  | 'upper_arms'
  | 'lower_length'
  | 'lower_bottom'
  | 'lower_knee'
  | 'lower_waist'
  | 'lower_hip'
  | 'lower_seat_round'
  | 'lower_inseam'
  | 'lower_thigh';

export type MeasurementValues = Partial<Record<MeasurementKey, string | number>>;

export interface MeasurementSet extends MeasurementValues {
  id: string;
  client: string;
  visit_label?: string;
  garment_types: GarmentType[];
  garment_count: number;
  suit_lapel_style?: LapelStyle;
  suit_button_stance?: ButtonStance;
  suit_vent?: VentStyle;
  cloth_image_url?: string;
  cloth_image?: string | null;
  fabric_details?: string;
  customization_notes?: string;
  created_at: string;
  created_by?: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
