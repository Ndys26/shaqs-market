import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Order, Stage } from '../types';
import { STAGES, STAGE_LABEL } from '../store';

export const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const rm0 = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`;
export const kg = (n: number) => `${n.toLocaleString('en-MY', { maximumFractionDigits: 1 })} kg`;
export const time = (iso: string) => new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
export const date = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
export const orderKg = (o: Order) => o.lines.reduce((t, l) => t + l.kg, 0);
export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={cx('glass rounded-2xl p-4 md:p-5', className)}>
      {children}
    </motion.div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = 'blue' }: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: 'blue' | 'green' | 'amber' }) {
  const toneCls = { blue: 'text-sky-300 bg-electric/20', green: 'text-emerald-300 bg-fresh/15', amber: 'text-amber-300 bg-amber-400/15' }[tone];
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className={cx('rounded-lg p-1.5', toneCls)}><Icon size={16} aria-hidden /></span>
      </div>
      <p className="tabular mt-2 text-2xl font-bold text-white md:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

const stageColor: Record<Stage, string> = {
  harvesting: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  processing: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  transit: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', stageColor[stage])}>
      {stage !== 'delivered' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function StageTrack({ order }: { order: Order }) {
  const idx = STAGES.indexOf(order.stage);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={`Status: ${STAGE_LABEL[order.stage]}`}>
      {STAGES.map((s, i) => (
        <li key={s} className="min-w-0">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/60">
            <motion.div className={cx('h-full', i <= idx ? 'bg-gradient-to-r from-electric to-fresh' : '')} initial={{ width: 0 }} animate={{ width: i <= idx ? '100%' : '0%' }} transition={{ duration: 0.6, delay: i * 0.1 }} />
          </div>
          <p className={cx('mt-1 truncate text-[10px] md:text-xs', i <= idx ? 'text-slate-200' : 'text-slate-500')}>{STAGE_LABEL[s]}</p>
          {order.stageAt[s] && <p className="tabular text-[10px] text-slate-500">{time(order.stageAt[s]!)}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Button({ children, onClick, variant = 'primary', className, disabled, type = 'button', ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'blue'; className?: string; disabled?: boolean; type?: 'button' | 'submit'; ariaLabel?: string;
}) {
  const v = {
    primary: 'bg-fresh text-ocean hover:bg-emerald-400 font-semibold',
    blue: 'bg-electric text-white hover:bg-sky-600 font-semibold',
    ghost: 'border border-slate-600/60 text-slate-200 hover:bg-white/5',
    danger: 'bg-rose-500 text-white hover:bg-rose-400 font-semibold',
  }[variant];
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }} type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40', v, className)}>
      {children}
    </motion.button>
  );
}

export interface TabDef { id: string; label: string; icon: LucideIcon }

/** Top tabs on desktop, fixed bottom navigation on phones. */
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <>
      <nav className="mb-5 hidden gap-1 rounded-2xl glass p-1 md:inline-flex" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} aria-current={active === t.id ? 'page' : undefined}
            className={cx('relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', active === t.id ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
            {active === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-xl bg-electric/40" transition={{ type: 'spring', duration: 0.4 }} />}
            <t.icon size={16} className="relative" aria-hidden /><span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-700/60 bg-ocean/95 backdrop-blur md:hidden" aria-label="Sections">
        <div className="flex">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => onChange(t.id)} aria-current={active === t.id ? 'page' : undefined}
              className={cx('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]', active === t.id ? 'text-emerald-300' : 'text-slate-400')}>
              <t.icon size={20} aria-hidden />{t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

type ToastKind = 'success' | 'warn' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string }
let push: ((t: ToastItem) => void) | null = null;
let nextId = 1;
export const toast = (text: string, kind: ToastKind = 'success') => push?.({ id: nextId++, kind, text });

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((xs) => [...xs.slice(-3), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4000);
    };
    return () => { push = null; };
  }, []);
  const icon = { success: CheckCircle2, warn: AlertTriangle, info: Info };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => {
          const I = icon[t.kind];
          return (
            <motion.div key={t.id} initial={{ opacity: 0, y: -12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
              className={cx('glass pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm', t.kind === 'warn' ? 'text-amber-200' : t.kind === 'info' ? 'text-sky-200' : 'text-emerald-200')}>
              <I size={18} aria-hidden />{t.text}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-slate-700/40', className)} />;
}
