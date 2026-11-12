export type Product = 'tilapia' | 'pekasam' | 'sayur';

/** How often a stall buys from the farm: core = most days, occasional = some weeks, rare = almost never (drinks, pastry). */
export type StallTier = 'core' | 'occasional' | 'rare';

export interface Stall {
  id: number;
  name: string;
  cuisine: string;
  owner: string;
  license: string;
  tier: StallTier;
  prefers: Product[];
}

export interface FishBatch {
  id: string;
  product: Product;
  grade: string;
  note: string;
  pond: string;
  harvestedKg: number;
  allocatedKg: number;
  /** Wholesale base rate, RM per kg. */
  basePrice: number;
  harvestedAt: string;
}

export type CutStyle = 'whole' | 'butterfly';
export type PackSize = 'none' | '5kg' | '10kg';

export interface ProcessingRequest {
  descale: boolean;
  cut: CutStyle;
  pack: PackSize;
  coldChain: boolean;
}

export interface OrderLine {
  batchId: string;
  product: Product;
  kg: number;
  /** Base rate at time of order, before any urgent surge. */
  pricePerKg: number;
  prep: ProcessingRequest;
}

export type DeliveryMode = 'standard' | 'urgent';

export type Stage = 'harvesting' | 'processing' | 'transit' | 'delivered';

export interface PriceBreakdown {
  fish: number;
  prep: number;
  logistics: number;
  surgeMultiplier: number;
  total: number;
  reasons: string[];
}

export interface Order {
  id: string;
  stallId: number;
  createdAt: string;
  deliverBy: string;
  mode: DeliveryMode;
  lines: OrderLine[];
  price: PriceBreakdown;
  stage: Stage;
  stageAt: Partial<Record<Stage, string>>;
  onTime?: boolean;
  /** Minutes from harvest start to kitchen hand-over. */
  turnaroundMin?: number;
  seeded?: boolean;
}

export type Persona = 'dashboard' | 'farm' | 'vendor';

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
}

/** cafe = one stall, farm = harvest & dispatch, admin = SHAQs Market team (sees everything). */
export type Role = 'cafe' | 'farm' | 'admin';

export interface Session {
  role: Role;
  name: string;
  email?: string;
  method: 'password' | 'register';
  /** Stall the session orders for. Admin uses it to preview the cafe screen. */
  stallId: number;
}
