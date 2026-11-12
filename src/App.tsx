import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ChefHat, Fish, LogOut, RotateCcw, Tractor, Volume2, VolumeX } from 'lucide-react';
import type { Persona, Role, Session } from './types';
import { onRemoteChange, resetToday, STAGE_LABEL } from './store';
import { audio, setSoundEnabled } from './audioService';
import { STALLS, stallById } from './mockData';
import { AuthScreen } from './components/Auth';
import { VendorView } from './components/Vendor';
import { FarmView } from './components/Farm';
import { DashboardView } from './components/Dashboard';
import { Toaster, cx, toast } from './components/ui';

// Per-tab UI prefs (persona, session, sound). Not shared, so each tab/device can play a different role.
interface Ui { persona: Persona; session: Session | null; sound: boolean }
const UI_KEY = 'shaqs-market:ui';

/** Screens each login may open. Admin (SHAQs Market team) sees everything. */
const ALLOWED: Record<Role, Persona[]> = { cafe: ['vendor'], farm: ['farm'], admin: ['dashboard', 'farm', 'vendor'] };

function loadUi(): Ui {
  const fallback: Ui = { persona: 'vendor', session: null, sound: true };
  try {
    const ui: Ui = { ...fallback, ...JSON.parse(sessionStorage.getItem(UI_KEY) ?? '{}') };
    // Drop stale or tampered values (old persona names, sessions from older versions) instead of rendering a blank page.
    if (ui.session && (!ALLOWED[ui.session.role] || !STALLS.some((s) => s.id === ui.session!.stallId))) ui.session = null;
    if (ui.session && !ALLOWED[ui.session.role].includes(ui.persona)) ui.persona = ALLOWED[ui.session.role][0];
    return ui;
  } catch { return fallback; }
}

const PERSONAS: { id: Persona; label: string; short: string; icon: typeof Fish }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard },
  { id: 'farm', label: 'Farm & Harvest', short: 'Farm', icon: Tractor },
  { id: 'vendor', label: 'Cafe Stall', short: 'Cafe', icon: ChefHat },
];

export default function App() {
  const [ui, setUi] = useState<Ui>(loadUi);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    try { sessionStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* storage blocked */ }
    setSoundEnabled(ui.sound);
  }, [ui]);

  // Sound + toast when another tab changes shared state.
  useEffect(() => onRemoteChange((prev, next) => {
    const fresh = next.orders.filter((o) => !prev.orders.some((p) => p.id === o.id));
    const p = uiRef.current.persona;
    if (!uiRef.current.session) return;
    if (fresh.length && p !== 'vendor') {
      if (fresh.some((o) => o.mode === 'urgent')) { audio.alert(); toast(`URGENT rush order from Stall #${fresh[0].stallId}`, 'warn'); }
      else { audio.kaching(); toast(`New order from Stall #${fresh[0].stallId}`, 'info'); }
    }
    if (next.batches.length > prev.batches.length && p !== 'farm') { audio.chime(); toast('Fresh harvest just listed', 'info'); }
    const myStall = uiRef.current.session.stallId;
    const moved = next.orders.find((o) => o.stallId === myStall && prev.orders.some((q) => q.id === o.id && q.stage !== o.stage));
    if (moved && p === 'vendor') { audio.click(); toast(`${moved.id}: ${STAGE_LABEL[moved.stage]}`, 'info'); }
  }), []);

  if (!ui.session) return <><AuthScreen onDone={(session) => setUi({ ...ui, session, persona: ALLOWED[session.role][0] })} /><Toaster /></>;

  const session = ui.session;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}shaqs-logo.png`} alt="SHAQs logo" className="h-9 w-9 object-contain" />
            <span className="hidden font-extrabold tracking-tight text-ink sm:inline">SHAQs Market</span>
          </div>

          {/* Screen switcher: admin only */}
          {session.role === 'admin' ? (
          <div className="glass flex rounded-xl p-0.5" role="tablist" aria-label="Screen">
            {PERSONAS.map((p) => (
              <button key={p.id} role="tab" aria-selected={ui.persona === p.id} title={p.label} onClick={() => { setUi({ ...ui, persona: p.id }); audio.click(); }}
                className={cx('relative flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold', ui.persona === p.id ? 'text-white' : 'text-slate-700')}>
                {ui.persona === p.id && <motion.span layoutId="persona" className="absolute inset-0 rounded-lg bg-fresh" transition={{ type: 'spring', duration: 0.35 }} />}
                <p.icon size={14} className="relative" aria-hidden /><span className="relative">{p.short}</span>
              </button>
            ))}
          </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{session.role === 'cafe' ? 'Cafe' : 'Farm'}</span>
          )}

          <div className="flex items-center gap-1">
            <div className="mr-2 hidden items-center gap-2 border-r border-slate-200 pr-3 xl:flex" aria-label="Programme partners">
              <img src={`${import.meta.env.BASE_URL}ucse-usec-logo.jpg`} alt="UCSE & USEC" className="h-8 w-auto" />
              <img src={`${import.meta.env.BASE_URL}umt-logo.png`} alt="Universiti Malaysia Terengganu" className="h-8 w-auto" />
            </div>
            <button onClick={() => setUi({ ...ui, sound: !ui.sound })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label={ui.sound ? 'Mute sounds' : 'Unmute sounds'} aria-pressed={ui.sound}>
              {ui.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {session.role === 'admin' && <button onClick={() => { if (confirm("Clear today's orders and restock today's harvest? The 60-day history is kept.")) { resetToday(); toast("Today's board cleared", 'info'); } }} className="hidden h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 sm:grid" aria-label="Clear today's orders"><RotateCcw size={18} /></button>}
            <button onClick={() => setUi({ ...ui, session: null })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label={`Sign out ${session.name}`}><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:py-8">
        <p className="mb-3 text-xs text-slate-500">Signed in as {session.name} · {ui.persona === 'vendor' ? `Stall #${session.stallId} ${stallById(session.stallId).name}` : PERSONAS.find((p) => p.id === ui.persona)!.label}</p>
        <motion.div key={ui.persona} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {ui.persona === 'vendor' && <VendorView stallId={session.stallId} />}
          {ui.persona === 'farm' && <FarmView />}
          {ui.persona === 'dashboard' && <DashboardView />}
        </motion.div>
      </main>
      <Toaster />
    </div>
  );
}
