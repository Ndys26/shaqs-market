import { useSyncExternalStore } from 'react';
import type { AuditEvent, DeliveryMode, FishBatch, Order, OrderLine, Product, Stage } from './types';
import { generateHistory, PRODUCTS, seedBatches, stallById } from './mockData';
import { NO_PREP, quote, type SurgeContext } from './pricing';
import { tr, type Key, type Vars } from './i18n';

/**
 * Shared live state, persisted in localStorage.
 * The browser's `storage` event syncs every open tab on the same device.
 * shortcut: no cross-device sync; add a Supabase/Firebase free-tier listener in subscribe() when two devices must share orders.
 */
export interface LiveState {
  version: 1;
  anchor: string;
  batches: FishBatch[];
  orders: Order[];
  events: AuditEvent[];
}

const KEY = 'shaqs-market:v3'; // v3: bilingual events and price reasons
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function fresh(): LiveState {
  const now = new Date();
  return {
    version: 1,
    anchor: now.toISOString(),
    batches: seedBatches(now),
    orders: [],
    events: [event('@ev.system', 'ev.loaded')],
  };
}

function load(): LiveState {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as LiveState) : null;
    // A new day starts a fresh live board, so "today's harvest" is never stale and history stays 60 days back.
    const sameDay = s && new Date(s.anchor).toDateString() === new Date().toDateString();
    if (sameDay && s.version === 1 && Array.isArray(s.batches) && Array.isArray(s.orders) && Array.isArray(s.events)) return s;
  } catch { /* corrupt or blocked storage: start fresh */ }
  return fresh();
}

let state = load();
let history = generateHistory(new Date(state.anchor));
const listeners = new Set<() => void>();
type RemoteHook = (prev: LiveState, next: LiveState) => void;
const remoteHooks = new Set<RemoteHook>();

function commit(next: LiveState) {
  if (next.anchor !== state.anchor) history = generateHistory(new Date(next.anchor));
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    let next: LiveState;
    try { next = JSON.parse(e.newValue); } catch { return; }
    const prev = state;
    if (next.anchor !== state.anchor) history = generateHistory(new Date(next.anchor));
    state = next;
    remoteHooks.forEach((h) => h(prev, next));
    listeners.forEach((l) => l());
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useLive = () => useSyncExternalStore(subscribe, () => state);
export const getHistory = () => history;
export const onRemoteChange = (h: RemoteHook) => { remoteHooks.add(h); return () => { remoteHooks.delete(h); }; };

export const remaining = (b: FishBatch) => Math.max(0, b.harvestedKg - b.allocatedKg);

export function surgeContext(s: LiveState, product: Product[] = []): SurgeContext {
  const pool = s.batches.filter((b) => !product.length || product.includes(b.product));
  const harvested = pool.reduce((t, b) => t + b.harvestedKg, 0);
  const allocated = pool.reduce((t, b) => t + b.allocatedKg, 0);
  return {
    scarcity: harvested ? allocated / harvested : 1,
    activeUrgent: s.orders.filter((o) => o.mode === 'urgent' && o.stage !== 'delivered').length,
    hour: new Date().getHours(),
  };
}

function event(actor: string, k: Key, v?: Vars): AuditEvent {
  return { id: uid(), at: new Date().toISOString(), actor, k, v, action: tr(k, v) };
}

export function placeOrder(stallId: number, lines: OrderLine[], mode: DeliveryMode, deliverBy: Date): Order {
  if (!lines.length) throw new Error(tr('err.cartEmpty'));
  if (lines.some((l) => !Number.isFinite(l.kg) || l.kg <= 0)) throw new Error(tr('err.qty'));
  const need = new Map<string, number>();
  lines.forEach((l) => need.set(l.batchId, (need.get(l.batchId) ?? 0) + l.kg));
  for (const [id, kg] of need) {
    const b = state.batches.find((x) => x.id === id);
    if (!b) throw new Error(tr('err.batchGone'));
    if (kg > remaining(b)) throw new Error(tr('err.notEnough', { kg: remaining(b), id: b.id }));
  }
  // Charge the farm's current rate, and take product and processing from the batch, not from the cart.
  lines = lines.map((l) => {
    const b = state.batches.find((x) => x.id === l.batchId)!;
    return { ...l, product: b.product, pricePerKg: b.basePrice, prep: PRODUCTS[b.product].fresh ? l.prep : NO_PREP };
  });
  const now = new Date();
  const order: Order = {
    id: `SM-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${uid().slice(0, 4)}`,
    stallId,
    createdAt: now.toISOString(),
    deliverBy: deliverBy.toISOString(),
    mode,
    lines,
    price: quote(lines, mode, surgeContext(state, lines.map((l) => l.product))),
    stage: 'harvesting',
    stageAt: { harvesting: now.toISOString() },
  };
  const kg = lines.reduce((t, l) => t + l.kg, 0);
  commit({
    ...state,
    batches: state.batches.map((b) => (need.has(b.id) ? { ...b, allocatedKg: b.allocatedKg + need.get(b.id)! } : b)),
    orders: [order, ...state.orders],
    events: [event(stallById(stallId).name, mode === 'urgent' ? 'ev.orderUrgent' : 'ev.order', { id: order.id, kg, total: `RM ${order.price.total.toFixed(2)}` }), ...state.events],
  });
  return order;
}

export const STAGES: Stage[] = ['harvesting', 'processing', 'transit', 'delivered'];
export const stageLabel = (s: Stage) => tr(`stage.${s}` as Key);

export function advanceOrder(id: string) {
  const now = new Date();
  let ev: AuditEvent | null = null;
  const orders = state.orders.map((o) => {
    if (o.id !== id || o.stage === 'delivered') return o;
    const stage = STAGES[STAGES.indexOf(o.stage) + 1];
    const next: Order = { ...o, stage, stageAt: { ...o.stageAt, [stage]: now.toISOString() } };
    if (stage === 'delivered') {
      next.onTime = now <= new Date(o.deliverBy);
      next.turnaroundMin = Math.round((now.getTime() - new Date(o.stageAt.harvesting ?? o.createdAt).getTime()) / 60000);
      ev = event('@persona.farm.full', next.onTime ? 'ev.delivered' : 'ev.deliveredLate', { id: o.id });
    } else {
      ev = event('@persona.farm.full', 'ev.stage', { id: o.id, stage: `@stage.${stage}` });
    }
    return next;
  });
  if (ev) commit({ ...state, orders, events: [ev, ...state.events] });
}

export function addBatch(b: Omit<FishBatch, 'id' | 'allocatedKg' | 'harvestedAt'>) {
  if (!(b.harvestedKg > 0) || !(b.basePrice > 0)) throw new Error(tr('err.addBatch'));
  const now = new Date();
  const batch: FishBatch = { ...b, id: `B-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${uid().slice(0, 3)}`, allocatedKg: 0, harvestedAt: now.toISOString() };
  commit({ ...state, batches: [batch, ...state.batches], events: [event('@persona.farm.full', 'ev.harvest', { id: batch.id, kg: b.harvestedKg, product: `@prod.${b.product}`, p: b.basePrice.toFixed(2) }), ...state.events] });
}

export function setBasePrice(id: string, price: number) {
  if (!(price > 0)) return;
  const b = state.batches.find((x) => x.id === id);
  if (!b || b.basePrice === price) return;
  commit({ ...state, batches: state.batches.map((x) => (x.id === id ? { ...x, basePrice: price } : x)), events: [event('@persona.farm.full', 'ev.rate', { id, a: b.basePrice.toFixed(2), b: price.toFixed(2) }), ...state.events] });
}

export function resetToday() {
  commit(fresh());
}
