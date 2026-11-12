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

// Apply edits onto the shared STALLS list so every screen shows them.
function apply() {
  const edits = load();
  for (const s of STALLS) Object.assign(s, ORIGINAL.get(s.id), edits[s.id] ?? {});
  version++;
  listeners.forEach((f) => f());
}

apply();
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) apply(); });

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
