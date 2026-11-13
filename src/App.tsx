import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, ChefHat, LogOut, RotateCcw, Tractor, Volume2, VolumeX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Persona, Role, Session } from './types';
import { onRemoteChange, resetToday, stageLabel } from './store';
import { audio, setSoundEnabled } from './audioService';
import { STALLS, stallById } from './mockData';
import { useCafes } from './cafes';
import { tr as t, useLang, type Key } from './i18n';
import { AuthScreen } from './components/Auth';
import { VendorView } from './components/Vendor';
import { FarmView } from './components/Farm';
import { DashboardView } from './components/Dashboard';
import { LangToggle, Toaster, cx, toast } from './components/ui';

// Per-tab UI prefs (persona, session, sound). Not shared, so each tab/device can play a different role.
interface Ui { persona: Persona; session: Session | null; sound: boolean }
const UI_KEY = 'shaqs-market:ui';
const BASE = import.meta.env.BASE_URL;

/** Screens each login may open. Admin (SHAQs Market team) sees everything. */
const ALLOWED: Record<Role, Persona[]> = { cafe: ['vendor'], farm: ['farm'], admin: ['dashboard', 'farm', 'vendor'] };

const PERSONAS: { id: Persona; icon: LucideIcon }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'farm', icon: Tractor },
  { id: 'vendor', icon: ChefHat },
];

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

/** Soft launch screen: logo grows in, then the app fades up underneath. */
function Launch({ onDone }: { onDone: () => void }) {
  useEffect(() => { const id = setTimeout(onDone, 1500); return () => clearTimeout(id); }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-white" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <div className="flex flex-col items-center">
        <div className="relative grid h-32 w-32 place-items-center">
          <motion.span className="absolute inset-0 rounded-full border-2 border-leaf" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.15, 1], opacity: [0, 0.8, 0] }} transition={{ duration: 1.3, ease: 'easeOut' }} />
          <motion.img src={`${BASE}shaqs-logo.png`} alt="SHAQs logo" className="h-24 w-24 object-contain"
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 14 }} />
        </div>
        <motion.p className="mt-3 text-2xl font-extrabold tracking-tight text-ink" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>SHAQs Market</motion.p>
        <motion.div className="mt-3 h-1 w-28 overflow-hidden rounded-full bg-slate-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <motion.div className="h-full bg-gradient-to-r from-electric to-fresh" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.45, duration: 0.95, ease: 'easeInOut' }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function App() {
  useLang(); // re-render everything when EN/BM changes
  useCafes(); // and when admin edits a cafe
  const reduce = useReducedMotion();
  const [launching, setLaunching] = useState(() => !reduce);
  const [ui, setUi] = useState<Ui>(loadUi);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    try { sessionStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* storage blocked */ }
    setSoundEnabled(ui.sound);
  }, [ui]);

  // Sound + toast when another tab changes shared state.
  useEffect(() => onRemoteChange((prev, next) => {
    const cur = uiRef.current;
    if (!cur.session) return;
    const p = cur.persona;
    const fresh = next.orders.filter((o) => !prev.orders.some((q) => q.id === o.id));
    if (fresh.length && p !== 'vendor') {
      if (fresh.some((o) => o.mode === 'urgent')) { audio.alert(); toast(t('toast.urgentOrder', { n: fresh[0].stallId }), 'warn'); }
      else { audio.kaching(); toast(t('toast.newOrder', { n: fresh[0].stallId }), 'info'); }
    }
    if (next.batches.length > prev.batches.length && p !== 'farm') { audio.chime(); toast(t('toast.harvest'), 'info'); }
    const moved = next.orders.find((o) => o.stallId === cur.session!.stallId && prev.orders.some((q) => q.id === o.id && q.stage !== o.stage));
    if (moved && p === 'vendor') { audio.click(); toast(t('toast.stage', { id: moved.id, stage: stageLabel(moved.stage) }), 'info'); }
  }), []);

  const session = ui.session;

  return (
    <>
      <AnimatePresence>{launching && <Launch key="launch" onDone={() => setLaunching(false)} />}</AnimatePresence>
      {!session ? (
        <AuthScreen onDone={(s) => setUi({ ...ui, session: s, persona: ALLOWED[s.role][0] })} />
      ) : (
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
              <div className="flex items-center gap-2">
                <img src={`${BASE}shaqs-logo.png`} alt="SHAQs logo" className="h-9 w-9 object-contain" />
                <span className="font-extrabold tracking-tight text-ink">SHAQs Market</span>
              </div>

              {/* Screen switcher: admin only. Own full-width row on phones. */}
              {session.role === 'admin' ? (
                <div className="glass order-last grid w-full grid-cols-3 rounded-xl p-0.5 sm:order-none sm:flex sm:w-auto" role="tablist" aria-label={t('a11y.screen')}>
                  {PERSONAS.map((p) => (
                    <button key={p.id} role="tab" aria-selected={ui.persona === p.id} onClick={() => { setUi({ ...ui, persona: p.id }); audio.click(); }}
                      className={cx('relative flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold', ui.persona === p.id ? 'text-white' : 'text-slate-700')}>
                      {ui.persona === p.id && <motion.span layoutId="persona" className="absolute inset-0 rounded-lg bg-fresh" transition={{ type: 'spring', duration: 0.35 }} />}
                      <p.icon size={15} className="relative" aria-hidden /><span className="relative">{t(`persona.${p.id}` as Key)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:inline">{t(session.role === 'cafe' ? 'persona.vendor' : 'persona.farm')}</span>
              )}

              <div className="flex items-center gap-1">
                <div className="mr-2 hidden items-center gap-2 border-r border-slate-200 pr-3 xl:flex" aria-label={t('a11y.partners')}>
                  <img src={`${BASE}ucse-usec-logo.jpg`} alt="UCSE & USEC" className="h-8 w-auto" />
                  <img src={`${BASE}umt-logo.png`} alt="Universiti Malaysia Terengganu" className="h-8 w-auto" />
                </div>
                <LangToggle className="mr-1" />
                <button onClick={() => setUi({ ...ui, sound: !ui.sound })} className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label={ui.sound ? t('a11y.mute') : t('a11y.unmute')} aria-pressed={ui.sound}>
                  {ui.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                {session.role === 'admin' && <button onClick={() => { if (confirm(t('reset.confirm'))) { resetToday(); toast(t('reset.done'), 'info'); } }} className="hidden h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 sm:grid" aria-label={t('a11y.reset')}><RotateCcw size={18} /></button>}
                <button onClick={() => setUi({ ...ui, session: null })} className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label={t('a11y.signOut')}><LogOut size={18} /></button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-5 md:py-8">
            <p className="mb-3 text-xs text-slate-500">
              {t('app.signedIn', { name: session.name })} · {ui.persona === 'vendor' ? `#${session.stallId} ${stallById(session.stallId).name}` : t(`persona.${ui.persona}.full` as Key)}
            </p>
            {/* No exit animation: AnimatePresence "wait" can stick when screens are switched quickly. */}
            <motion.div key={ui.persona} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {ui.persona === 'vendor' && <VendorView stallId={session.stallId} />}
              {ui.persona === 'farm' && <FarmView />}
              {ui.persona === 'dashboard' && <DashboardView />}
            </motion.div>
          </main>
        </div>
      )}
      <Toaster />
    </>
  );
}
