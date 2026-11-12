import type { FishBatch, Order, OrderLine, ProcessingRequest, Species, Stall } from './types';
import { quote } from './pricing';

export const SPECIES: Record<Species, { label: string; local: string; color: string; range: [number, number] }> = {
  siakap: { label: 'Asian Seabass', local: 'Siakap', color: '#38bdf8', range: [20, 24] },
  tilapia: { label: 'Red Tilapia', local: 'Tilapia Merah', color: '#f472b6', range: [12, 15] },
  patin: { label: 'River Patin', local: 'Patin', color: '#fbbf24', range: [13, 17] },
};

// 5 core fish buyers, 3 occasional, 3 that rarely or never buy fish (drinks, pastry, roti).
export const STALLS: Stall[] = [
  { id: 1, name: 'Nasi Melayu Mak Teh', cuisine: 'Nasi Melayu', owner: 'Puan Rohani', license: 'PBT-KF-0101', tier: 'core', prefers: ['tilapia', 'patin'] },
  { id: 2, name: 'Nasi Campur Selera Kita', cuisine: 'Nasi Campur', owner: 'Encik Faizal', license: 'PBT-KF-0102', tier: 'core', prefers: ['tilapia', 'siakap'] },
  { id: 3, name: 'Mee & Kuey Teow Abang Li', cuisine: 'Noodles', owner: 'Encik Ali', license: 'PBT-KF-0103', tier: 'occasional', prefers: ['tilapia'] },
  { id: 4, name: 'Asam Pedas & Ikan Bakar Kak Yah', cuisine: 'Asam Pedas Specialist', owner: 'Puan Zakiah', license: 'PBT-KF-0104', tier: 'core', prefers: ['patin', 'siakap'] },
  { id: 5, name: 'Roti Canai Bistro', cuisine: 'Roti & Kopi', owner: 'Encik Rajesh', license: 'PBT-KF-0105', tier: 'rare', prefers: ['tilapia'] },
  { id: 6, name: 'Nasi Ayam Hainan', cuisine: 'Chicken Rice', owner: 'Encik Wong', license: 'PBT-KF-0106', tier: 'occasional', prefers: ['siakap'] },
  { id: 7, name: 'Sup & Tomyam Pak Su', cuisine: 'Sup & Tomyam', owner: 'Encik Sulaiman', license: 'PBT-KF-0107', tier: 'core', prefers: ['siakap', 'tilapia'] },
  { id: 8, name: 'Dapur Thai Selatan', cuisine: 'Thai', owner: 'Puan Nok', license: 'PBT-KF-0108', tier: 'occasional', prefers: ['siakap', 'tilapia'] },
  { id: 9, name: 'Jus & Minuman Segar', cuisine: 'Drinks', owner: 'Cik Aina', license: 'PBT-KF-0109', tier: 'rare', prefers: [] },
  { id: 10, name: 'Kuih & Pastri Nenek', cuisine: 'Kuih & Pastry', owner: 'Puan Habsah', license: 'PBT-KF-0110', tier: 'rare', prefers: [] },
  { id: 11, name: 'Western Seafood Corner', cuisine: 'Fish & Chips', owner: 'Encik Daniel', license: 'PBT-KF-0111', tier: 'core', prefers: ['patin', 'siakap'] },
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
  // Slow price drift per species, kept inside realistic wholesale ranges.
  const price: Record<Species, number> = { siakap: 22, tilapia: 13.5, patin: 15 };

  for (let back = 60; back >= 1; back--) {
    const day = new Date(anchor);
    day.setDate(day.getDate() - back);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    (Object.keys(price) as Species[]).forEach((sp) => {
      const [lo, hi] = SPECIES[sp].range;
      price[sp] = Math.min(hi, Math.max(lo, Math.round((price[sp] + between(-0.4, 0.4)) * 2) / 2));
    });

    let seq = 1;
    for (const stall of STALLS) {
      if (!stall.prefers.length || rnd() > BUY_CHANCE[stall.tier]) continue;
      const urgent = rnd() < 0.1;
      const species = pick(stall.prefers);
      const kg = stall.tier === 'core' ? Math.round(between(6, 14)) : Math.round(between(5, 10));
      const prep: ProcessingRequest = {
        descale: rnd() < 0.85,
        cut: stall.id === 11 || (species === 'siakap' && rnd() < 0.3) ? 'butterfly' : 'whole',
        pack: kg >= 10 ? '10kg' : rnd() < 0.6 ? '5kg' : 'none',
        coldChain: rnd() < 0.7,
      };
      const line: OrderLine = { batchId: `H-${day.toISOString().slice(2, 10).replace(/-/g, '')}-${species.slice(0, 2).toUpperCase()}`, species, kg, pricePerKg: price[species], prep };

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
    { id: `B-${tag}-SK`, species: 'siakap', grade: 'Grade A · 800g–1.2kg/fish', note: 'Cage culture, ice-slurry harvested', pond: 'Cage C2', harvestedKg: 60, allocatedKg: 22, basePrice: 22, harvestedAt: iso },
    { id: `B-${tag}-TL`, species: 'tilapia', grade: 'Live tank harvest · 500–700g', note: 'Purged 24h in clean-water tank', pond: 'Tank T4', harvestedKg: 80, allocatedKg: 45, basePrice: 13.5, harvestedAt: iso },
    { id: `B-${tag}-PT`, species: 'patin', grade: 'Cold-chain preserved · 1–1.5kg', note: 'Chilled 0–4°C, temp-logged', pond: 'Pond P1', harvestedKg: 50, allocatedKg: 18, basePrice: 15, harvestedAt: iso },
  ];
}
