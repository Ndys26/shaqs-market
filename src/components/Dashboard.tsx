import { useMemo, useState } from 'react';
import { Activity as ActivityIcon, BadgeCheck, Clock, Gauge, LayoutDashboard, Radio, ScrollText, Store, Timer, Users, Weight, Wallet } from 'lucide-react';
import type { Order, Product } from '../types';
import { PRODUCTS, STALLS } from '../mockData';
import { getHistory, remaining, useLive } from '../store';
import { Card, StageBadge, StageTrack, Stat, Tabs, cx, date, kg, orderKg, rm, rm0, time } from './ui';

export function DashboardView() {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-amber-700">Platform dashboard · read-only</p>
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Cafeteria pilot overview</h2>
        <p className="text-sm text-slate-600">11 stalls · last 60 days · traceable from pond to kitchen</p>
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'live', label: 'Live', icon: Radio },
        { id: 'stalls', label: 'Stalls', icon: Store },
        { id: 'activity', label: 'Activity', icon: ScrollText },
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

function Overview() {
  const all = useAllDelivered();
  const m = useMemo(() => {
    const totalKg = all.reduce((t, o) => t + orderKg(o), 0);
    const value = all.reduce((t, o) => t + o.price.total, 0);
    const onTime = all.filter((o) => o.onTime).length / Math.max(1, all.length);
    const avgTurn = all.reduce((t, o) => t + (o.turnaroundMin ?? 0), 0) / Math.max(1, all.length);
    const days = new Set(all.map((o) => o.stageAt.delivered!.slice(0, 10))).size;
    const buyers = new Set(all.map((o) => o.stallId)).size;

    // Price stability = 100 × (1 − mean coefficient of variation of daily base price per product).
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
    const product = (Object.keys(PRODUCTS) as Product[]).map((sp) => ({ sp, kg: all.reduce((t, o) => t + o.lines.filter((l) => l.product === sp).reduce((a, l) => a + l.kg, 0), 0) }));
    return { totalKg, value, onTime, avgTurn, days, buyers, stability, weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)), product };
  }, [all]);

  const maxW = Math.max(...m.weeks.map(([, w]) => w.kg), 1);
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Produce supplied" value={kg(Math.round(m.totalKg))} sub={`${m.days} operating days · ~${Math.round(m.totalKg / Math.max(1, m.days))} kg/day`} icon={Weight} tone="green" />
        <Stat label="Transaction value" value={rm0(m.value)} sub={`${all.length} orders`} icon={Wallet} />
        <Stat label="On-time delivery" value={`${(m.onTime * 100).toFixed(1)}%`} sub={`${all.filter((o) => !o.onTime).length} late deliveries logged`} icon={BadgeCheck} tone="green" />
        <Stat label="Harvest → kitchen" value={`${Math.floor(m.avgTurn / 60)}h ${Math.round(m.avgTurn % 60)}m`} sub="average turnaround, target < 4h" icon={Timer} tone="amber" />
        <Stat label="Price stability" value={`${m.stability.toFixed(1)}`} sub="index /100 · lower price swings = higher" icon={Gauge} />
        <Stat label="Active buyers" value={`${m.buyers} / ${STALLS.length}`} sub="drinks & pastry stalls don't buy produce" icon={Users} />
      </div>

      <Card>
        <h3 className="mb-1 font-semibold text-ink">Weekly volume</h3>
        <p className="mb-4 text-xs text-slate-600">Kilograms delivered per week (Mon–Fri trading)</p>
        <div className="flex h-48 items-end gap-1.5 md:gap-3" role="img" aria-label="Weekly kilograms bar chart">
          {m.weeks.map(([wk, w]) => (
            <div key={wk} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular text-[10px] text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-100">{Math.round(w.kg)}</span>
              <div className="w-full rounded-t-md bg-gradient-to-t from-electric to-fresh transition-all" style={{ height: `${(w.kg / maxW) * 100}%` }} title={`${date(wk)}: ${Math.round(w.kg)} kg, ${rm0(w.value)}`} />
              <span className="text-[10px] text-slate-500">{date(wk)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-ink">Product mix</h3>
        <div className="flex h-3 overflow-hidden rounded-full">
          {m.product.map(({ sp, kg: k }) => <div key={sp} style={{ width: `${(k / Math.max(1, m.totalKg)) * 100}%`, background: PRODUCTS[sp].color }} />)}
        </div>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {m.product.map(({ sp, kg: k }) => (
            <li key={sp} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PRODUCTS[sp].color }} />{PRODUCTS[sp].local}<span className="tabular ml-auto text-slate-700">{kg(k)} · RM {PRODUCTS[sp].range[0]}–{PRODUCTS[sp].range[1]}/kg</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Live() {
  const live = useLive();
  const open = live.orders.filter((o) => o.stage !== 'delivered');
  const harvested = live.batches.reduce((t, b) => t + b.harvestedKg, 0);
  const allocated = live.batches.reduce((t, b) => t + b.allocatedKg, 0);
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-slate-600">Harvested today</p><p className="tabular text-xl font-bold text-ink">{kg(harvested)}</p></Card>
        <Card><p className="text-xs text-slate-600">Allocated</p><p className="tabular text-xl font-bold text-ink">{kg(allocated)}</p></Card>
        <Card><p className="text-xs text-slate-600">In pipeline</p><p className="tabular text-xl font-bold text-ink">{open.length}</p></Card>
      </div>
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><ActivityIcon size={18} aria-hidden />Today's batches</h3>
        <ul className="space-y-3">
          {live.batches.map((b) => (
            <li key={b.id}>
              <div className="flex justify-between text-sm"><span className="text-ink">{PRODUCTS[b.product].local} <span className="font-mono text-xs text-slate-500">{b.id}</span></span><span className="tabular text-slate-700">{rm(b.basePrice)}/kg · {remaining(b)} kg left</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-gradient-to-r from-electric to-fresh" style={{ width: `${(b.allocatedKg / b.harvestedKg) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </Card>
      {open.map((o) => (
        <Card key={o.id}>
          <div className="mb-3 flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-ink">{o.id} · Stall #{o.stallId} · {orderKg(o)} kg</p><StageBadge stage={o.stage} /></div>
          <StageTrack order={o} />
        </Card>
      ))}
      {!open.length && <Card><p className="text-sm text-slate-600">No orders in transit right now.</p></Card>}
    </div>
  );
}

function Stalls() {
  const all = useAllDelivered();
  const rows = STALLS.map((s) => {
    const os = all.filter((o) => o.stallId === s.id);
    const last = os.reduce<string | null>((l, o) => (!l || o.stageAt.delivered! > l ? o.stageAt.delivered! : l), null);
    return { s, n: os.length, kg: os.reduce((t, o) => t + orderKg(o), 0), value: os.reduce((t, o) => t + o.price.total, 0), last, onTime: os.filter((o) => o.onTime).length };
  });
  const maxKg = Math.max(...rows.map((r) => r.kg), 1);
  return (
    <div className="space-y-2 pb-20 md:pb-0">
      {rows.map(({ s, n, kg: k, value, last, onTime }) => (
        <Card key={s.id} className="p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">#{s.id} {s.name}</p>
              <p className="text-xs text-slate-600">{s.cuisine} · {s.license} · {s.owner}</p>
            </div>
            {n ? (
              <div className="tabular text-right text-sm">
                <p className="font-semibold text-ink">{kg(k)} · {rm0(value)}</p>
                <p className="text-xs text-slate-600">{n} orders · {onTime}/{n} on time · last {date(last!)}</p>
              </div>
            ) : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">No purchases</span>}
          </div>
          {!!n && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={cx('h-full', s.tier === 'core' ? 'bg-fresh' : 'bg-electric')} style={{ width: `${(k / maxKg) * 100}%` }} /></div>}
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
      <div className="space-y-4">
        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink"><Clock size={18} aria-hidden />Live activity log</h3>
          <ol className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {live.events.map((e) => (
              <li key={e.id} className="border-l-2 border-electric/60 pl-3">
                <p className="text-slate-700">{e.action}</p>
                <p className="text-xs text-slate-500">{date(e.at)} {time(e.at)} · {e.actor}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <h3 className="mb-2 font-semibold text-ink">Most recent delivered orders</h3>
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-600"><tr><th className="py-2">Order</th><th>Stall</th><th className="text-right">kg</th><th className="text-right">RM</th><th className="pl-3">Status</th></tr></thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-t border-slate-200">
                <td className="py-2 font-mono text-xs text-slate-600">{o.id}</td>
                <td>#{o.stallId}</td>
                <td className="tabular text-right">{orderKg(o)}</td>
                <td className="tabular text-right">{o.price.total.toFixed(2)}</td>
                <td className={cx('pl-3 text-xs', o.onTime ? 'text-emerald-700' : 'text-amber-700')}>{o.onTime ? 'On time' : 'Late'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
