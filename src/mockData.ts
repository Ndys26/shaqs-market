import type { FishBatch, Order, OrderLine, ProcessingRequest, Product, Stall } from './types';
import { quote } from './pricing';

// SHAQs products (Laporan Fasa 3): fresh tilapia, tilapia pekasam, aquaponic vegetables.
// shortcut: price bands are estimates, not from the report; replace with real selling prices.
export const PRODUCTS: Record<Product, { label: string; local: string; color: string; range: [number, number]; fresh: boolean }> = {
  tilapia: { label: 'Fresh Red Tilapia', local: 'Tilapia Segar', color: '#d9467a', range: [12, 15], fresh: true },
  pekasam: { label: 'Tilapia Pekasam', local: 'Pekasam', color: '#c27c0e', range: [28, 34], fresh: false },
  sayur: { label: 'Aquaponic Vegetables', local: 'Sayur Akuaponik', color: '#3f8f2f', range: [8, 12], fresh: false },
};

// 5 core buyers, 3 occasional, 3 that rarely or never buy (drinks, pastry, roti).
export const STALLS: Stall[] = [
  { id: 1, name: 'Kafe Selera Kampung', cuisine: 'Nasi Melayu', owner: 'Puan Rohani', tier: 'core', prefers: ['tilapia', 'pekasam', 'sayur'] },
  { id: 2, name: 'Kafe Seri Pantai', cuisine: 'Nasi Campur', owner: 'Encik Faizal', tier: 'core', prefers: ['tilapia', 'sayur'] },
  { id: 3, name: 'Kafe Mi Sedap', cuisine: 'Mi & Kuey Teow', owner: 'Encik Ali', tier: 'occasional', prefers: ['sayur'] },
  { id: 4, name: 'Kafe Asam Pedas Warisan', cuisine: 'Asam Pedas & Ikan Bakar', owner: 'Puan Zakiah', tier: 'core', prefers: ['tilapia', 'pekasam'] },
  { id: 5, name: 'Kafe Roti & Kopi Pagi', cuisine: 'Roti Canai & Kopi', owner: 'Encik Rajesh', tier: 'rare', prefers: ['tilapia'] },
  { id: 6, name: 'Kafe Nasi Ayam Mesra', cuisine: 'Nasi Ayam', owner: 'Encik Wong', tier: 'occasional', prefers: ['sayur'] },
  { id: 7, name: 'Kafe Sup & Tomyam Bayu', cuisine: 'Sup & Tomyam', owner: 'Encik Sulaiman', tier: 'core', prefers: ['tilapia', 'sayur'] },
  { id: 8, name: 'Kafe Rasa Thai', cuisine: 'Masakan Thai', owner: 'Puan Nok', tier: 'occasional', prefers: ['tilapia', 'sayur'] },
  { id: 9, name: 'Kafe Jus Segar', cuisine: 'Minuman & Jus', owner: 'Cik Aina', tier: 'rare', prefers: [] },
  { id: 10, name: 'Kafe Kuih Tradisi', cuisine: 'Kuih & Pastri', owner: 'Puan Habsah', tier: 'rare', prefers: [] },
  { id: 11, name: 'Kafe Fish & Chips Ombak', cuisine: 'Fish & Chips', owner: 'Encik Daniel', tier: 'core', prefers: ['tilapia'] },
];

export const stallById = (id: number) => STALLS.find((s) => s.id === id)!;

// Deterministic PRNG so every device shows the same history.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (d: Date, h: number, m: number) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

const BUY_CHANCE = { core: 0.5, occasional: 0.15, rare: 0.02 } as const;

/** 60 calendar days of history ending the day before `anchor`; weekdays only. */
export function generateHistory(anchor: Date): Order[] {
  const rnd = mulberry32(20260412);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const orders: Order[] = [];
  // Slow price drift per product, kept inside realistic wholesale ranges.
  const price: Record<Product, number> = { tilapia: 13.5, pekasam: 30, sayur: 10 };

  for (let back = 60; back >= 1; back--) {
    const day = new Date(anchor);
    day.setDate(day.getDate() - back);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    (Object.keys(price) as Product[]).forEach((sp) => {
      const [lo, hi] = PRODUCTS[sp].range;
      price[sp] = Math.min(hi, Math.max(lo, Math.round((price[sp] + between(-0.4, 0.4)) * 2) / 2));
    });

    let seq = 1;
    for (const stall of STALLS) {
      if (!stall.prefers.length || rnd() > BUY_CHANCE[stall.tier]) continue;
      const urgent = rnd() < 0.1;
      const product = pick(stall.prefers);
      const [lo, hi] = product === 'tilapia' ? (stall.tier === 'core' ? [6, 14] : [5, 10]) : product === 'pekasam' ? [2, 5] : [3, 8];
      const kg = Math.round(between(lo, hi));
      const fresh = PRODUCTS[product].fresh;
      const prep: ProcessingRequest = {
        descale: fresh && rnd() < 0.85,
        cut: fresh && (stall.id === 11 || rnd() < 0.2) ? 'butterfly' : 'whole',
        pack: !fresh ? 'none' : kg >= 10 ? '10kg' : rnd() < 0.6 ? '5kg' : 'none',
        coldChain: fresh && rnd() < 0.7,
      };
      const line: OrderLine = { batchId: `H-${day.toISOString().slice(2, 10).replace(/-/g, '')}-${product.slice(0, 2).toUpperCase()}`, product, kg, pricePerKg: price[product], prep };

      const created = urgent ? at(day, 9, Math.floor(between(0, 50))) : at(addMin(day, -24 * 60), 15, Math.floor(between(0, 59)));
      const deliverBy = urgent ? addMin(created, 120) : at(day, 10, 30);
      const turnaround = Math.round(urgent ? between(85, 140) : between(150, 230));
      const onTime = rnd() > 0.025;
      const delivered = addMin(deliverBy, onTime ? -Math.round(between(5, 25)) : Math.round(between(10, 35)));
      const harvestStart = addMin(delivered, -turnaround);

      orders.push({
        id: `SM-${day.toISOString().slice(2, 10).replace(/-/g, '')}-${String(seq++).padStart(2, '0')}`,
        stallId: stall.id,
        createdAt: created.toISOString(),
        deliverBy: deliverBy.toISOString(),
        mode: urgent ? 'urgent' : 'standard',
        lines: [line],
        price: quote([line], urgent ? 'urgent' : 'standard', { scarcity: between(0.2, 0.6), activeUrgent: 0, hour: 9 }),
        stage: 'delivered',
        stageAt: {
          harvesting: harvestStart.toISOString(),
          processing: addMin(harvestStart, Math.round(turnaround * 0.35)).toISOString(),
          transit: addMin(harvestStart, Math.round(turnaround * 0.7)).toISOString(),
          delivered: delivered.toISOString(),
        },
        onTime,
        turnaroundMin: turnaround,
        seeded: true,
      });
    }
  }
  return orders;
}

export function seedBatches(today: Date): FishBatch[] {
  const iso = at(today, 6, 30).toISOString();
  const tag = today.toISOString().slice(2, 10).replace(/-/g, '');
  return [
    { id: `B-${tag}-TL`, product: 'tilapia', grade: '@seed.tl.grade', note: '@seed.tl.note', pond: '@seed.tl.src', harvestedKg: 60, allocatedKg: 24, basePrice: 13.5, harvestedAt: iso },
    { id: `B-${tag}-PK`, product: 'pekasam', grade: '@seed.pk.grade', note: '@seed.pk.note', pond: '@seed.pk.src', harvestedKg: 25, allocatedKg: 8, basePrice: 30, harvestedAt: iso },
    { id: `B-${tag}-SY`, product: 'sayur', grade: '@seed.sy.grade', note: '@seed.sy.note', pond: '@seed.sy.src', harvestedKg: 30, allocatedKg: 10, basePrice: 10, harvestedAt: iso },
  ];
}
