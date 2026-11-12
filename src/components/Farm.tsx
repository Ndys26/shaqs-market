import { useState } from 'react';
import { ArrowRight, ClipboardList, Fish, PackageCheck, Scale, Waves } from 'lucide-react';
import type { Product } from '../types';
import { PRODUCTS, stallById } from '../mockData';
import { addBatch, advanceOrder, remaining, setBasePrice, STAGES, STAGE_LABEL, useLive } from '../store';
import { audio } from '../audioService';
import { Button, Card, StageBadge, StageTrack, Tabs, cx, kg, orderKg, rm, time, toast } from './ui';

export function FarmView() {
  const [tab, setTab] = useState('queue');
  return (
    <div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-sky-700">Farm & Harvest</p>
        <h2 className="text-2xl font-bold text-ink md:text-3xl">Harvest & dispatch control</h2>
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'queue', label: 'Order queue', icon: ClipboardList },
        { id: 'harvest', label: 'Harvest log', icon: Waves },
      ]} />
      {tab === 'queue' ? <Queue /> : <Harvest />}
    </div>
  );
}

const ACTION: Record<string, string> = { harvesting: 'Start scaling & gutting', processing: 'Dispatch cold-chain', transit: 'Confirm delivered' };

function Queue() {
  const live = useLive();
  const open = live.orders.filter((o) => o.stage !== 'delivered').sort((a, b) => (a.mode === b.mode ? a.deliverBy.localeCompare(b.deliverBy) : a.mode === 'urgent' ? -1 : 1));
  const done = live.orders.filter((o) => o.stage === 'delivered');
  return (
    <div className="space-y-3 pb-20 md:pb-0">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s) => (
          <Card key={s}><p className="text-xs text-slate-600">{STAGE_LABEL[s]}</p><p className="tabular text-2xl font-bold text-ink">{live.orders.filter((o) => o.stage === s).length}</p></Card>
        ))}
      </div>
      {!open.length && <Card><p className="text-sm text-slate-600">No open orders. New orders from stalls appear here instantly, with a sound cue.</p></Card>}
      {open.map((o) => (
        <Card key={o.id} className={cx(o.mode === 'urgent' && 'ring-1 ring-amber-400/50')}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{o.id} {o.mode === 'urgent' && <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">RUSH</span>}</p>
              <p className="text-xs text-slate-600">#{o.stallId} {stallById(o.stallId).name} · due {time(o.deliverBy)}</p>
            </div>
            <StageBadge stage={o.stage} />
          </div>
          <ul className="mb-3 space-y-1 text-sm">
            {o.lines.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <span className="font-medium text-ink">{l.kg} kg {PRODUCTS[l.product].local}</span>
                <span className="text-xs text-slate-700">{[l.prep.descale && 'Descale+gut', l.prep.cut === 'butterfly' ? 'Butterfly' : 'Whole', l.prep.pack !== 'none' && `Vacuum ${l.prep.pack}`, l.prep.coldChain && 'Ice + temp log'].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <StageTrack order={o} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-sm text-slate-700">{orderKg(o)} kg · <b className="text-ink">{rm(o.price.total)}</b></p>
            <Button variant="blue" onClick={() => { advanceOrder(o.id); if (o.stage === 'transit') audio.kaching(); else audio.click(); }}>{ACTION[o.stage]}<ArrowRight size={16} aria-hidden /></Button>
          </div>
        </Card>
      ))}
      {!!done.length && (
        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink"><PackageCheck size={18} aria-hidden />Delivered today</h3>
          <ul className="divide-y divide-slate-200 text-sm">
            {done.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{o.id} · #{o.stallId} · {orderKg(o)} kg</span>
                <span className={o.onTime ? 'text-emerald-700' : 'text-amber-700'}>{o.onTime ? 'On time' : 'Late'} · {o.turnaroundMin} min</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Harvest() {
  const live = useLive();
  const [f, setF] = useState({ product: 'tilapia' as Product, kg: 30, price: 13.5, grade: 'Grade A', note: 'Fresh harvest, ice-slurry chilled', pond: 'Tank T2' });
  const submit = () => {
    try {
      addBatch({ product: f.product, harvestedKg: f.kg, basePrice: f.price, grade: f.grade, note: f.note, pond: f.pond });
      audio.chime();
      toast(`Harvest logged: ${f.kg} kg ${PRODUCTS[f.product].local}`);
    } catch (e) { toast((e as Error).message, 'warn'); }
  };
  const [lo, hi] = PRODUCTS[f.product].range;
  return (
    <div className="grid gap-4 pb-20 md:pb-0 lg:grid-cols-[360px_1fr]">
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><Scale size={18} aria-hidden />Log new harvest</h3>
        <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Product">
            {(Object.keys(PRODUCTS) as Product[]).map((s) => (
              <button type="button" key={s} role="radio" aria-checked={f.product === s} onClick={() => setF({ ...f, product: s, price: (PRODUCTS[s].range[0] + PRODUCTS[s].range[1]) / 2 })}
                className={cx('min-h-11 rounded-lg text-xs font-medium', f.product === s ? 'bg-electric text-white' : 'border border-slate-300 text-slate-700')}>{PRODUCTS[s].local}</button>
            ))}
          </div>
          <div className="flex gap-1">{[30, 50, 120].map((n) => (
            <button type="button" key={n} onClick={() => setF({ ...f, kg: n })} className={cx('min-h-9 flex-1 rounded-lg text-xs', f.kg === n ? 'bg-fresh text-white font-semibold' : 'border border-slate-300 text-slate-700')}>{n} kg</button>
          ))}</div>
          <label className="block"><span className="text-slate-700">Weight (kg)</span>
            <input type="number" min={1} step={1} value={f.kg} onChange={(e) => setF({ ...f, kg: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink" /></label>
          <label className="block"><span className="text-slate-700">Base rate (RM/kg) <span className="text-slate-500">market band RM {lo}–{hi}</span></span>
            <input type="number" min={0.5} step={0.5} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink" /></label>
          {(f.price < lo || f.price > hi) && <p className="text-xs text-amber-700">Outside the usual wholesale band (RM {lo}–{hi}/kg). Check before publishing.</p>}
          {(['grade', 'pond', 'note'] as const).map((k) => (
            <label key={k} className="block"><span className="capitalize text-slate-700">{k}</span>
              <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink" /></label>
          ))}
          <Button type="submit" className="w-full"><Fish size={16} aria-hidden />Publish to catalogue</Button>
        </form>
      </Card>
      <div className="space-y-3">
        {live.batches.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{PRODUCTS[b.product].local} · <span className="font-mono text-xs text-slate-600">{b.id}</span></p>
                <p className="text-xs text-slate-600">{b.grade} · {b.pond} · harvested {time(b.harvestedAt)}</p>
                <p className="tabular mt-1 text-sm text-slate-700">{kg(b.harvestedKg)} harvested · {kg(b.allocatedKg)} allocated · <b className="text-emerald-700">{kg(remaining(b))} left</b></p>
              </div>
              <label className="flex items-center gap-2 text-sm"><span className="text-slate-600">RM/kg</span>
                <input key={b.basePrice} type="number" min={0.5} step={0.5} defaultValue={b.basePrice} aria-label={`Base rate for ${b.id}`}
                  onBlur={(e) => setBasePrice(b.id, Number(e.target.value))} className="tabular min-h-10 w-20 rounded-lg border border-slate-300 bg-white px-2 text-ink" /></label>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
