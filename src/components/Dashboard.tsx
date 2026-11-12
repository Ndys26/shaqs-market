import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity as ActivityIcon, BadgeCheck, Clock, Gauge, HandCoins, LayoutDashboard, Leaf, Radio, ScrollText, Store, Timer, Users, Weight, Wallet } from 'lucide-react';
import type { Order, Product } from '../types';
import { PRODUCTS, STALLS } from '../mockData';
import { getHistory, remaining, useLive } from '../store';
import { tr as t } from '../i18n';
import { Card, CountUp, StageBadge, StageTrack, Stat, Tabs, cx, date, kg, orderKg, rm, rm0, time } from './ui';

export function DashboardView() {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-emerald-700">{t('d.kicker')}</p>
        <h2 className="text-2xl font-bold text-ink md:text-3xl">{t('d.title')}</h2>
        <p className="text-sm text-slate-600">{t('d.sub')}</p>
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: t('tab.overview'), icon: LayoutDashboard },
        { id: 'live', label: t('tab.live'), icon: Radio },
        { id: 'stalls', label: t('tab.stalls'), icon: Store },
        { id: 'activity', label: t('tab.activity'), icon: ScrollText },
      ]} />
      {tab === 'overview' && <Overview />}
      {tab === 'live' && <Live />}
      {tab === 'stalls' && <Stalls />}
      {tab === 'activity' && <Activity />}
    </div>
  );
}

function useAllDelivered(): Order[] {
  const live = useLive();
  return useMemo(() => [...getHistory(), ...live.orders.filter((o) => o.stage === 'delivered')], [live]);
}

const hm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

function Overview() {
  const all = useAllDelivered();
  const m = useMemo(() => {
    const totalKg = all.reduce((s, o) => s + orderKg(o), 0);
    const value = all.reduce((s, o) => s + o.price.total, 0);
    const onTime = all.filter((o) => o.onTime).length / Math.max(1, all.length);
    const avgTurn = all.reduce((s, o) => s + (o.turnaroundMin ?? 0), 0) / Math.max(1, all.length);
    const days = new Set(all.map((o) => o.stageAt.delivered!.slice(0, 10))).size;
    const buyers = new Set(all.map((o) => o.stallId)).size;

    // Price stability = 100 × (1 − mean coefficient of variation of base price per product).
    const cv = (Object.keys(PRODUCTS) as Product[]).map((sp) => {
      const p = all.flatMap((o) => o.lines.filter((l) => l.product === sp).map((l) => l.pricePerKg));
      const mean = p.reduce((a, b) => a + b, 0) / Math.max(1, p.length);
      const sd = Math.sqrt(p.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, p.length));
      return mean ? sd / mean : 0;
    });
    const stability = 100 * (1 - cv.reduce((a, b) => a + b, 0) / cv.length);

    // Weekly kg (Monday-start weeks).
    const weeks = new Map<string, { kg: number; value: number }>();
    for (const o of all) {
      const d = new Date(o.stageAt.delivered!);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      d.setHours(12, 0, 0, 0); // midday so the UTC date key never slips to Sunday
      const k = d.toISOString().slice(0, 10);
      const w = weeks.get(k) ?? { kg: 0, value: 0 };
      w.kg += orderKg(o); w.value += o.price.total;
      weeks.set(k, w);
    }
    const product = (Object.keys(PRODUCTS) as Product[]).map((sp) => ({ sp, kg: all.reduce((s, o) => s + o.lines.filter((l) => l.product === sp).reduce((a, l) => a + l.kg, 0), 0) }));
    return { totalKg, value, onTime, avgTurn, days, buyers, stability, weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)), product };
  }, [all]);

  const maxW = Math.max(...m.weeks.map(([, w]) => w.kg), 1);
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-[#1f4d6b] to-fresh p-5 text-white shadow-xl md:p-8">
        <svg className="wave pointer-events-none absolute bottom-0 left-0 h-16 w-[200%] opacity-25" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 30 Q75 0 150 30 T300 30 T450 30 T600 30 T750 30 T900 30 T1050 30 T1200 30 V60 H0Z" fill="#8cc63f" />
        </svg>
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" /></span>
            {t('d.live')}
          </span>
          <p className="mt-4 text-sm text-white/80">{t('d.heroLabel')}</p>
          <p className="tabular text-5xl font-extrabold tracking-tight md:text-7xl"><CountUp value={m.totalKg} format={(n) => kg(Math.round(n))} /></p>
          <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">{t('d.heroSub', { n: m.buyers, t: hm(m.avgTurn) })}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><HandCoins size={14} aria-hidden />{t('d.share')}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Leaf size={14} aria-hidden />{t('d.sdg')}</span>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat i={1} label={t('d.supplied')} value={<CountUp value={m.totalKg} format={(n) => kg(Math.round(n))} />} sub={t('d.suppliedSub', { d: m.days, k: Math.round(m.totalKg / Math.max(1, m.days)) })} icon={Weight} tone="green" />
        <Stat i={2} label={t('d.value')} value={<CountUp value={m.value} format={rm0} />} sub={t('d.orders', { n: all.length })} icon={Wallet} />
        <Stat i={3} label={t('d.onTime')} value={<CountUp value={m.onTime * 100} format={(n) => `${n.toFixed(1)}%`} />} sub={t('d.lateSub', { n: all.filter((o) => !o.onTime).length })} icon={BadgeCheck} tone="green" />
        <Stat i={4} label={t('d.turn')} value={hm(m.avgTurn)} sub={t('d.turnSub')} icon={Timer} tone="amber" />
        <Stat i={5} label={t('d.stab')} value={<CountUp value={m.stability} format={(n) => n.toFixed(1)} />} sub={t('d.stabSub')} icon={Gauge} />
        <Stat i={6} label={t('d.buyers')} value={`${m.buyers} / ${STALLS.length}`} sub={t('d.buyersSub')} icon={Users} />
      </div>

      <Card i={7}>
        <h3 className="mb-1 font-semibold text-ink">{t('d.weekly')}</h3>
        <p className="mb-4 text-xs text-slate-600">{t('d.weeklySub')}</p>
        <div className="flex h-48 items-end gap-1.5 md:gap-3" role="img" aria-label={t('d.chart')}>
          {m.weeks.map(([wk, w], i) => (
            <div key={wk} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular hidden text-[10px] text-slate-700 sm:block">{Math.round(w.kg)}</span>
              <motion.div className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-electric to-fresh" style={{ height: `${(w.kg / maxW) * 100}%` }}
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.8, delay: 0.5 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                title={`${date(wk)}: ${Math.round(w.kg)} kg, ${rm0(w.value)}`} />
              <span className="text-[9px] text-slate-500 sm:text-[10px]">{date(wk)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card i={8}>
        <h3 className="mb-3 font-semibold text-ink">{t('d.mix')}</h3>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {m.product.map(({ sp, kg: k }, i) => (
            <motion.div key={sp} style={{ background: PRODUCTS[sp].color }} initial={{ width: 0 }} animate={{ width: `${(k / Math.max(1, m.totalKg)) * 100}%` }} transition={{ duration: 0.9, delay: 0.7 + i * 0.1 }} />
          ))}
        </div>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {m.product.map(({ sp, kg: k }) => (
            <li key={sp} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRODUCTS[sp].color }} />{t(`prod.${sp}`)}<span className="tabular ml-auto text-slate-700">{kg(k)}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Live() {
  const live = useLive();
  const open = live.orders.filter((o) => o.stage !== 'delivered');
  const harvested = live.batches.reduce((s, b) => s + b.harvestedKg, 0);
  const allocated = live.batches.reduce((s, b) => s + b.allocatedKg, 0);
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="grid grid-cols-3 gap-3">
        <Card i={0}><p className="text-xs text-slate-600">{t('d.harvestedToday')}</p><p className="tabular text-xl font-bold text-ink">{kg(harvested)}</p></Card>
        <Card i={1}><p className="text-xs text-slate-600">{t('d.booked')}</p><p className="tabular text-xl font-bold text-ink">{kg(allocated)}</p></Card>
        <Card i={2}><p className="text-xs text-slate-600">{t('d.pipeline')}</p><p className="tabular text-xl font-bold text-ink">{open.length}</p></Card>
      </div>
      <Card i={3}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><ActivityIcon size={18} aria-hidden />{t('d.todayStock')}</h3>
        <ul className="space-y-3">
          {live.batches.map((b) => (
            <li key={b.id}>
              <div className="flex flex-wrap justify-between gap-x-2 text-sm"><span className="text-ink">{t(`prod.${b.product}`)} <span className="font-mono text-xs text-slate-500">{b.id}</span></span><span className="tabular text-slate-700">{t('d.leftLine', { p: rm(b.basePrice), n: remaining(b) })}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><motion.div className="h-full bg-gradient-to-r from-electric to-fresh" initial={{ width: 0 }} animate={{ width: `${(b.allocatedKg / b.harvestedKg) * 100}%` }} transition={{ duration: 0.8 }} /></div>
            </li>
          ))}
        </ul>
      </Card>
      {open.map((o, i) => (
        <Card key={o.id} i={4 + i}>
          <div className="mb-3 flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-ink">{t('d.orderLine', { id: o.id, s: o.stallId, kg: orderKg(o) })}</p><StageBadge stage={o.stage} /></div>
          <StageTrack order={o} />
        </Card>
      ))}
      {!open.length && <Card i={4}><p className="text-sm text-slate-600">{t('d.noTransit')}</p></Card>}
    </div>
  );
}

function Stalls() {
  const all = useAllDelivered();
  const rows = STALLS.map((s) => {
    const os = all.filter((o) => o.stallId === s.id);
    const last = os.reduce<string | null>((l, o) => (!l || o.stageAt.delivered! > l ? o.stageAt.delivered! : l), null);
    return { s, n: os.length, kg: os.reduce((a, o) => a + orderKg(o), 0), value: os.reduce((a, o) => a + o.price.total, 0), last, onTime: os.filter((o) => o.onTime).length };
  });
  const maxKg = Math.max(...rows.map((r) => r.kg), 1);
  return (
    <div className="space-y-2 pb-20 md:pb-0">
      {rows.map(({ s, n, kg: k, value, last, onTime }, i) => (
        <Card key={s.id} i={i} className="p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">#{s.id} {s.name}</p>
              <p className="text-xs text-slate-600">{s.cuisine} · {s.license} · {s.owner}</p>
            </div>
            {n ? (
              <div className="tabular text-right text-sm">
                <p className="font-semibold text-ink">{kg(k)} · {rm0(value)}</p>
                <p className="text-xs text-slate-600">{t('d.stallStats', { n, o: onTime, d: date(last!) })}</p>
              </div>
            ) : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{t('d.noPurchases')}</span>}
          </div>
          {!!n && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><motion.div className={cx('h-full', s.tier === 'core' ? 'bg-fresh' : 'bg-electric')} initial={{ width: 0 }} animate={{ width: `${(k / maxKg) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }} /></div>}
        </Card>
      ))}
    </div>
  );
}

function Activity() {
  const live = useLive();
  const all = useAllDelivered();
  const recent = useMemo(() => [...all].sort((a, b) => b.stageAt.delivered!.localeCompare(a.stageAt.delivered!)).slice(0, 15), [all]);
  return (
    <div className="grid gap-4 pb-20 md:pb-0 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink"><Clock size={18} aria-hidden />{t('d.log')}</h3>
        <ol className="max-h-96 space-y-2 overflow-y-auto text-sm">
          {live.events.map((e) => (
            <li key={e.id} className="border-l-2 border-electric/60 pl-3">
              <p className="text-slate-700">{e.k ? t(e.k, e.v) : e.action}</p>
              <p className="text-xs text-slate-500">{date(e.at)} {time(e.at)} · {t(e.actor)}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Card i={1} className="overflow-x-auto">
        <h3 className="mb-2 font-semibold text-ink">{t('d.recent')}</h3>
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-600"><tr><th className="py-2">{t('th.order')}</th><th>{t('th.stall')}</th><th className="text-right">kg</th><th className="text-right">RM</th><th className="pl-3">{t('th.status')}</th></tr></thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-t border-slate-200">
                <td className="py-2 font-mono text-xs text-slate-600">{o.id}</td>
                <td>#{o.stallId}</td>
                <td className="tabular text-right">{orderKg(o)}</td>
                <td className="tabular text-right">{o.price.total.toFixed(2)}</td>
                <td className={cx('pl-3 text-xs', o.onTime ? 'text-emerald-700' : 'text-amber-700')}>{o.onTime ? t('onTime') : t('late')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
