import { useSyncExternalStore } from 'react';
import { STALLS } from './mockData';

/**
 * Admin edits to cafe name, food type and owner.
 * shortcut: saved in this browser only (other devices keep the built-in names); move to a shared database for real use.
 */
type CafeEdit = { name: string; cuisine: string; owner: string };
const KEY = 'shaqs-market:cafes';
const ORIGINAL = new Map(STALLS.map((s) => [s.id, { name: s.name, cuisine: s.cuisine, owner: s.owner }]));

let version = 0;
const listeners = new Set<() => void>();

function load(): Record<number, CafeEdit> {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return x && typeof x === 'object' ? x : {};
  } catch {
    return {};
  }
}

// Cafes that registered themselves (name typed by the cafe). Same browser-only limit as edits.
type NewCafe = CafeEdit & { id: number };
const NEW_KEY = 'shaqs-market:newcafes';

function loadNew(): NewCafe[] {
  try {
    const x = JSON.parse(localStorage.getItem(NEW_KEY) ?? '[]');
    return Array.isArray(x) ? x.filter((c) => Number.isInteger(c?.id) && typeof c?.name === 'string' && c.name.trim()) : [];
  } catch {
    return [];
  }
}

// Apply new cafes and edits onto the shared STALLS list so every screen shows them.
function apply() {
  for (const c of loadNew()) {
    if (ORIGINAL.has(c.id)) continue;
    const base = { name: c.name, cuisine: c.cuisine ?? '', owner: c.owner ?? '' };
    ORIGINAL.set(c.id, base);
    // prefers: [] keeps new cafes out of the sample history.
    STALLS.push({ id: c.id, ...base, tier: 'rare', prefers: [] });
  }
  const edits = load();
  for (const s of STALLS) Object.assign(s, ORIGINAL.get(s.id), edits[s.id] ?? {});
  version++;
  listeners.forEach((f) => f());
}

apply();
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === NEW_KEY) apply(); });

/** Adds a cafe registered by its owner and returns its new id. */
export function addCafe(c: CafeEdit): number {
  const clean = { name: c.name.trim(), cuisine: c.cuisine.trim(), owner: c.owner.trim() };
  if (!clean.name) throw new Error('name');
  const id = Math.max(0, ...STALLS.map((s) => s.id)) + 1;
  localStorage.setItem(NEW_KEY, JSON.stringify([...loadNew(), { id, ...clean }]));
  apply();
  return id;
}

export function saveCafe(id: number, edit: CafeEdit) {
  const clean = { name: edit.name.trim(), cuisine: edit.cuisine.trim(), owner: edit.owner.trim() };
  if (!clean.name) throw new Error('name');
  const all = load();
  all[id] = clean;
  localStorage.setItem(KEY, JSON.stringify(all));
  apply();
}

export function resetCafe(id: number) {
  const all = load();
  delete all[id];
  localStorage.setItem(KEY, JSON.stringify(all));
  apply();
}

export const isEdited = (id: number) => id in load();

/** Re-renders the caller when a cafe is edited (here or in another tab). */
export const useCafes = () =>
  useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => version);
