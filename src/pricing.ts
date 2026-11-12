import type { DeliveryMode, OrderLine, PriceBreakdown, ProcessingRequest, Reason } from './types';

/** Pekasam and vegetables get no fish processing. */
export const NO_PREP: ProcessingRequest = { descale: false, cut: 'whole', pack: 'none', coldChain: false };

export const PREP_FEES = {
  descalePerKg: 1.0,
  butterflyPerKg: 2.5,
  pack: { none: 0, '5kg': 1.5, '10kg': 2.0 },
  coldChainFlat: 3.0,
  urgentDispatch: 15.0,
} as const;

export const MAX_SURGE = 1.25;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function prepCost(line: Pick<OrderLine, 'kg' | 'prep'>): number {
  const { kg, prep } = line;
  let c = 0;
  if (prep.descale) c += PREP_FEES.descalePerKg * kg;
  if (prep.cut === 'butterfly') c += PREP_FEES.butterflyPerKg * kg;
  if (prep.pack !== 'none') c += Math.ceil(kg / (prep.pack === '5kg' ? 5 : 10)) * PREP_FEES.pack[prep.pack];
  return round2(c);
}

export interface SurgeContext {
  /** Share of today's harvest already allocated, 0..1. */
  scarcity: number;
  /** Urgent orders already waiting for a rider. */
  activeUrgent: number;
  /** Local hour of the order, 0..23. */
  hour: number;
}

/**
 * Rule-based dynamic pricing for same-day rush orders.
 * Every factor is shown to the buyer, so every price can be explained.
 */
export function surge(ctx: SurgeContext): { multiplier: number; reasons: Reason[] } {
  const reasons: Reason[] = [{ k: 'r.base' }];
  let m = 1.08;
  const s = Math.min(0.1, Math.max(0, ctx.scarcity) * 0.1);
  if (s >= 0.01) {
    m += s;
    reasons.push({ k: 'r.scarce', v: { pct: Math.round(ctx.scarcity * 100), add: Math.round(s * 100) } });
  }
  const r = Math.min(0.06, ctx.activeUrgent * 0.02);
  if (r > 0) {
    m += r;
    reasons.push({ k: 'r.queue', v: { n: ctx.activeUrgent, add: Math.round(r * 100) } });
  }
  if (ctx.hour >= 9 && ctx.hour < 12) {
    m += 0.04;
    reasons.push({ k: 'r.lunch' });
  }
  const multiplier = Math.min(MAX_SURGE, round2(m));
  if (multiplier === MAX_SURGE) reasons.push({ k: 'r.cap', v: { n: Math.round((MAX_SURGE - 1) * 100) } });
  return { multiplier, reasons };
}

export function quote(lines: OrderLine[], mode: DeliveryMode, ctx: SurgeContext): PriceBreakdown {
  const { multiplier, reasons } =
    mode === 'urgent' ? surge(ctx) : { multiplier: 1, reasons: [{ k: 'r.standard' }] as Reason[] };
  const fish = round2(lines.reduce((t, l) => t + l.kg * l.pricePerKg * multiplier, 0));
  const prep = round2(
    lines.reduce((t, l) => t + prepCost(l), 0) + (lines.some((l) => l.prep.coldChain) ? PREP_FEES.coldChainFlat : 0),
  );
  const logistics = mode === 'urgent' && lines.length ? PREP_FEES.urgentDispatch : 0;
  return { fish, prep, logistics, surgeMultiplier: multiplier, total: round2(fish + prep + logistics), reasons };
}

// Self-check of the money logic, dev only.
if (import.meta.env.DEV) {
  const line: OrderLine = {
    batchId: 'x', product: 'tilapia', kg: 20, pricePerKg: 13.5,
    prep: { descale: true, cut: 'whole', pack: '5kg', coldChain: true },
  };
  const std = quote([line], 'standard', { scarcity: 0, activeUrgent: 0, hour: 15 });
  console.assert(std.fish === 270 && std.prep === 20 + 6 + 3 && std.total === 299, 'standard quote', std);
  const max = surge({ scarcity: 1, activeUrgent: 10, hour: 10 });
  console.assert(max.multiplier === MAX_SURGE, 'surge cap', max);
  const urg = quote([line], 'urgent', { scarcity: 0, activeUrgent: 0, hour: 15 });
  console.assert(urg.fish === 291.6 && urg.logistics === 15, 'urgent quote', urg);
}
