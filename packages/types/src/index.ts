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

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderType = 'full' | 'alteration';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  full: 'Full bespoke',
  alteration: 'Alteration only',
};

export const ORDER_STATUSES: OrderStatus[] = [
  'order_received',
  'requirements_noted',
  'cutting_started',
  'stitching_in_progress',
  'ready_for_trial',
  'alteration_in_progress',
  'ready_for_qc',
  'qc_rejected',
  'ready_for_delivery',
  'delivered',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_received: 'Order received',
  requirements_noted: 'Requirements noted',
  cutting_started: 'Cutting started',
  stitching_in_progress: 'Stitching in progress',
  ready_for_trial: 'Ready for trial',
  alteration_in_progress: 'Alteration in progress',
  ready_for_qc: 'Ready for QC',
  qc_rejected: 'QC rejected',
  ready_for_delivery: 'Ready for delivery',
  delivered: 'Delivered',
};

export type StatusTone =
  | 'received'
  | 'production'
  | 'trial'
  | 'rejected'
  | 'ready'
  | 'delivered';

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  order_received: 'received',
  requirements_noted: 'received',
  cutting_started: 'production',
  stitching_in_progress: 'production',
  ready_for_trial: 'trial',
  alteration_in_progress: 'trial',
  ready_for_qc: 'production',
  qc_rejected: 'rejected',
  ready_for_delivery: 'ready',
  delivered: 'delivered',
};

export interface OrderLineItem {
  id?: string;
  garment_type: GarmentType;
  fabric_description?: string;
  quantity: number;
  unit_price: string | number;
  customization_notes?: string;
  position?: number;
  line_total?: string | number;
}

export interface OrderStatusEvent {
  id: string;
  from_status: OrderStatus | '';
  to_status: OrderStatus;
  actor: string | null;
  actor_name: string;
  actor_role: Role | null;
  reason: string;
  created_at: string;
}

export interface OrderListItem {
  id: string;
  order_id: string;
  client: ClientSummary;
  order_type: OrderType;
  status: OrderStatus;
  trial_date?: string | null;
  delivery_date?: string | null;
  delivered_at?: string | null;
  subtotal: string;
  advance: string;
  balance: string;
  notes?: string;
  garment_summary?: string;
  line_item_count?: number;
  days_since_creation?: number;
  next_statuses?: OrderStatus[];
  created_at: string;
  updated_at: string;
}

export interface Order extends OrderListItem {
  line_items: OrderLineItem[];
  status_events: OrderStatusEvent[];
  measurement_set?: string | null;
}

export interface OrderStats {
  total: number;
  active: number;
  delivered_today: number;
  created_last_7_days: number;
  by_status: { status: OrderStatus; count: number }[];
}

// ---------------------------------------------------------------------------
// QA
// ---------------------------------------------------------------------------

export type QcOutcome = 'pass' | 'fail';
export type QcResult = 'pass' | 'fail';

export interface QcChecklistItemDef {
  key: string;
  label: string;
  description: string;
}

export interface QcChecklistResponse {
  result: QcResult;
  note: string;
}

export interface QcInspection {
  id: string;
  order: string;
  inspector: string | null;
  inspector_name: string;
  outcome: QcOutcome;
  checklist: Record<string, QcChecklistResponse>;
  overall_comment: string;
  failed_items: string[];
  created_at: string;
}
