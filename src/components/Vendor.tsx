import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronUp, ClipboardList, History, Minus, Plus, ShoppingCart, Sparkles, Store, Trash2, Truck, Zap } from 'lucide-react';
import type { DeliveryMode, FishBatch, OrderLine, ProcessingRequest } from '../types';
import { PRODUCTS, stallById } from '../mockData';
import { getHistory, placeOrder, remaining, surgeContext, useLive } from '../store';
import { NO_PREP, prepCost, quote } from '../pricing';
import { audio } from '../audioService';
import { Button, Card, StageBadge, StageTrack, Tabs, cx, date, kg, orderKg, rm, time, toast } from './ui';

const DEFAULT_PREP: ProcessingRequest = { descale: true, cut: 'whole', pack: '5kg', coldChain: true };

function slots(): { label: string; at: Date }[] {
  const d = new Date();
  const next = (days: number, h: number, m: number) => { const x = new Date(d); x.setDate(x.getDate() + days); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); x.setHours(h, m, 0, 0); return x; };
  const fmt = (x: Date) => x.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
  return [next(1, 10, 0), next(1, 11, 30), next(2, 10, 0)].map((at) => ({ at, label: `${fmt(at)} · ${time(at.toISOString())}` }));
}

export function VendorView({ stallId }: { stallId: number }) {
  const [tab, setTab] = useState('catalog');
  const stall = stallById(stallId);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-700">Stall #{stall.id} · {stall.cuisine}</p>
          <h2 className="text-2xl font-bold text-ink md:text-3xl">{stall.name}</h2>
        </div>
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'catalog', label: 'Order', icon: Store },
        { id: 'orders', label: 'Tracking', icon: Truck },
        { id: 'history', label: 'History', icon: History },
      ]} />
      {tab === 'catalog' && <Catalog stallId={stallId} onPlaced={() => setTab('orders')} />}
      {tab === 'orders' && <MyOrders stallId={stallId} />}
      {tab === 'history' && <StallHistory stallId={stallId} />}
    </div>
  );
}

function Catalog({ stallId, onPlaced }: { stallId: number; onPlaced: () => void }) {
  const live = useLive();
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<DeliveryMode>('standard');
  const [slot, setSlot] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const slotList = useMemo(slots, []);

  const inCart = (id: string) => cart.filter((l) => l.batchId === id).reduce((t, l) => t + l.kg, 0);
  // Price lines at the farm's current rate so the total shown is the total charged.
  const priced = cart.map((l) => ({ ...l, pricePerKg: live.batches.find((b) => b.id === l.batchId)?.basePrice ?? l.pricePerKg }));
  const ctx = surgeContext(live, cart.map((l) => l.product));
  const q = quote(priced, mode, ctx);
  const preview = quote(priced, 'urgent', ctx);

  const checkout = () => {
    try {
      const deliverBy = mode === 'urgent' ? new Date(Date.now() + 2 * 3600_000) : slotList[slot].at;
      const o = placeOrder(stallId, cart, mode, deliverBy);
      audio.kaching();
      toast(`Order ${o.id} placed · ${rm(o.price.total)}`);
      setCart([]);
      setDrawer(false);
      onPlaced();
    } catch (e) {
      audio.alert();
      toast((e as Error).message, 'warn');
    }
  };

  const summary = (
    <CartPanel cart={cart} setCart={setCart} mode={mode} setMode={setMode} slot={slot} setSlot={setSlot} slots={slotList} q={q} urgentPreview={preview.surgeMultiplier} onCheckout={checkout} live={live.batches} />
  );

  return (
    <div className="grid gap-5 pb-28 lg:grid-cols-[1fr_380px] md:pb-0">
      <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {live.batches.map((b) => (
          <BatchCard key={b.id} b={b} reserved={inCart(b.id)} open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
            onAdd={(line) => {
              setCart((c) => [...c, line]);
              setOpen(null);
              audio.click();
              toast(`${line.kg} kg ${PRODUCTS[line.product].local} added`, 'info');
            }} />
        ))}
      </div>

      <div className="hidden lg:block"><div className="sticky top-20">{summary}</div></div>

      {/* Phone / tablet sticky checkout drawer */}
      <div className="fixed inset-x-0 bottom-14 z-20 px-3 pb-2 md:bottom-0 lg:hidden">
        <AnimatePresence>
          {drawer && (
            <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="mb-2 max-h-[70vh] overflow-y-auto rounded-2xl">{summary}</motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setDrawer(!drawer)} className="glass flex min-h-14 w-full items-center justify-between rounded-2xl px-4 text-left" aria-expanded={drawer}>
          <span className="flex items-center gap-2 text-sm text-slate-700"><ShoppingCart size={18} aria-hidden />{cart.length} line(s) · {kg(cart.reduce((t, l) => t + l.kg, 0))}</span>
          <span className="flex items-center gap-2 font-bold text-ink tabular">{rm(q.total)}<ChevronUp size={18} className={cx('transition-transform', drawer && 'rotate-180')} aria-hidden /></span>
        </button>
      </div>
    </div>
  );
}

function BatchCard({ b, reserved, open, onToggle, onAdd }: { b: FishBatch; reserved: number; open: boolean; onToggle: () => void; onAdd: (l: OrderLine) => void }) {
  const sp = PRODUCTS[b.product];
  const left = remaining(b) - reserved;
  const [qty, setQty] = useState(() => Math.max(1, Math.min(10, left)));
  const [prep, setPrep] = useState<ProcessingRequest>(sp.fresh ? DEFAULT_PREP : NO_PREP);
  const allocPct = (b.allocatedKg / b.harvestedKg) * 100;
  const bump = (d: number) => { setQty((v) => Math.min(left, Math.max(1, v + d))); audio.click(); };
  const valid = qty >= 1 && qty <= left;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sp.color }}>{sp.local}</p>
          <h3 className="text-lg font-bold text-ink">{sp.label}</h3>
          <p className="text-xs text-slate-600">{b.grade}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-xl font-bold text-ink">{rm(b.basePrice)}</p>
          <p className="text-[11px] text-slate-600">per kg</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">{b.note} · {b.pond} · {b.id}</p>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <motion.div className="h-full bg-gradient-to-r from-electric to-fresh" initial={{ width: 0 }} animate={{ width: `${allocPct}%` }} transition={{ duration: 0.8 }} />
        </div>
        <p className="tabular mt-1.5 text-xs text-slate-700">Harvested {b.harvestedKg} kg · Allocated {b.allocatedKg} kg · <span className={cx('font-semibold', left < 10 ? 'text-amber-700' : 'text-emerald-700')}>Remaining {remaining(b)} kg</span></p>
      </div>
      <Button variant={open ? 'ghost' : 'blue'} className="mt-3" onClick={onToggle} disabled={left < 1}>{left < 1 ? 'Fully allocated' : open ? 'Close' : 'Configure order'}</Button>

      <AnimatePresence>
        {open && left >= 1 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Quantity</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => bump(-1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300" aria-label="Remove 1 kg"><Minus size={16} /></button>
                  <input type="number" min={1} max={left} value={qty} onChange={(e) => setQty(Math.floor(Number(e.target.value)) || 0)} aria-label="Kilograms"
                    className="tabular h-10 w-16 rounded-lg border border-slate-300 bg-white text-center text-ink" />
                  <button onClick={() => bump(1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300" aria-label="Add 1 kg"><Plus size={16} /></button>
                  <button onClick={() => bump(5)} className="h-10 rounded-lg border border-slate-300 px-2 text-xs" aria-label="Add 5 kg">+5</button>
                </div>
              </div>
              {!valid && <p className="text-xs text-amber-700">Choose 1–{left} kg.</p>}
              {sp.fresh && (<>
              <label className="flex min-h-10 items-center justify-between gap-2"><span className="text-slate-700">Descale & gut <span className="text-slate-500">+RM 1.00/kg</span></span>
                <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={prep.descale} onChange={(e) => setPrep({ ...prep, descale: e.target.checked })} /></label>
              <fieldset className="flex items-center justify-between gap-2"><legend className="sr-only">Cut</legend><span className="text-slate-700">Cut</span>
                <div className="flex gap-1">{(['whole', 'butterfly'] as const).map((c) => (
                  <button key={c} onClick={() => setPrep({ ...prep, cut: c })} aria-pressed={prep.cut === c} className={cx('min-h-9 rounded-lg px-2.5 text-xs', prep.cut === c ? 'bg-electric text-white' : 'border border-slate-300 text-slate-700')}>{c === 'whole' ? 'Whole round' : 'Butterfly +2.50/kg'}</button>
                ))}</div></fieldset>
              <fieldset className="flex items-center justify-between gap-2"><legend className="sr-only">Vacuum pack</legend><span className="text-slate-700">Vacuum pack</span>
                <div className="flex gap-1">{(['none', '5kg', '10kg'] as const).map((p) => (
                  <button key={p} onClick={() => setPrep({ ...prep, pack: p })} aria-pressed={prep.pack === p} className={cx('min-h-9 rounded-lg px-2.5 text-xs', prep.pack === p ? 'bg-electric text-white' : 'border border-slate-300 text-slate-700')}>{p === 'none' ? 'None' : p === '5kg' ? '5 kg' : '10 kg bulk'}</button>
                ))}</div></fieldset>
              <label className="flex min-h-10 items-center justify-between gap-2"><span className="text-slate-700">Ice pack + temperature log <span className="text-slate-500">RM 3/order</span></span>
                <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={prep.coldChain} onChange={(e) => setPrep({ ...prep, coldChain: e.target.checked })} /></label>
              </>)}
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                <span>Goods {rm(qty * b.basePrice)} + prep {rm(prepCost({ kg: Math.max(0, qty), prep }))}</span>
              </div>
              <Button className="w-full" disabled={!valid} onClick={() => onAdd({ batchId: b.id, product: b.product, kg: qty, pricePerKg: b.basePrice, prep })}><Plus size={16} aria-hidden />Add {qty} kg to cart</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CartPanel({ cart, setCart, mode, setMode, slot, setSlot, slots, q, urgentPreview, onCheckout, live }: {
  cart: OrderLine[]; setCart: (f: (c: OrderLine[]) => OrderLine[]) => void; mode: DeliveryMode; setMode: (m: DeliveryMode) => void;
  slot: number; setSlot: (n: number) => void; slots: { label: string; at: Date }[]; q: ReturnType<typeof quote>; urgentPreview: number; onCheckout: () => void; live: FishBatch[];
}) {
  return (
    <div className="glass space-y-4 rounded-2xl p-4 md:p-5">
      <h3 className="flex items-center gap-2 font-bold text-ink"><ShoppingCart size={18} aria-hidden />Cart</h3>
      {!cart.length && <p className="text-sm text-slate-600">Configure a batch and add kilograms to start an order.</p>}
      <ul className="space-y-2">
        {cart.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-2 rounded-xl bg-slate-100 p-3 text-sm">
            <div>
              <p className="font-semibold text-ink">{l.kg} kg {PRODUCTS[l.product].local}</p>
              <p className="text-xs text-slate-600">{[l.prep.descale && 'Descaled', l.prep.cut === 'butterfly' ? 'Butterfly' : 'Whole', l.prep.pack !== 'none' && `Vacuum ${l.prep.pack}`, l.prep.coldChain && 'Cold-chain'].filter(Boolean).join(' · ')}</p>
              {!live.some((b) => b.id === l.batchId) && <p className="text-xs text-amber-700">Batch no longer listed</p>}
            </div>
            <button onClick={() => setCart((c) => c.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-rose-600" aria-label="Remove line"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery mode">
        {(['standard', 'urgent'] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); if (m === 'urgent') audio.alert(); }}
            className={cx('min-h-16 rounded-xl border p-2 text-left text-xs', mode === m ? (m === 'urgent' ? 'border-amber-400 bg-amber-400/10' : 'border-emerald-400 bg-fresh/10') : 'border-slate-300')}>
            <span className="flex items-center gap-1 font-semibold text-ink">{m === 'urgent' ? <Zap size={14} className="text-amber-700" aria-hidden /> : <Truck size={14} className="text-emerald-700" aria-hidden />}{m === 'urgent' ? 'Urgent rush' : 'Scheduled'}</span>
            <span className="text-slate-600">{m === 'urgent' ? `Within 2 h · ×${urgentPreview.toFixed(2)}` : '24–48 h · standard rate'}</span>
          </button>
        ))}
      </div>

      {mode === 'standard' ? (
        <label className="block text-sm"><span className="text-slate-700">Delivery slot</span>
          <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink">
            {slots.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select></label>
      ) : (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs">
          <p className="mb-1 flex items-center gap-1 font-semibold text-amber-700"><Sparkles size={14} aria-hidden />Dynamic pricing engine</p>
          <ul className="space-y-0.5 text-slate-700">{q.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
        </div>
      )}

      <dl className="tabular space-y-1 border-t border-slate-200 pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-slate-600">Goods{q.surgeMultiplier > 1 && ` (×${q.surgeMultiplier.toFixed(2)})`}</dt><dd>{rm(q.fish)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Processing & cold-chain</dt><dd>{rm(q.prep)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Priority logistics</dt><dd>{q.logistics ? rm(q.logistics) : 'Included'}</dd></div>
        <div className="flex justify-between pt-1 text-lg font-bold text-ink"><dt>Total</dt><dd>
          <AnimatePresence mode="popLayout"><motion.span key={q.total} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block">{rm(q.total)}</motion.span></AnimatePresence>
        </dd></div>
      </dl>
      <Button className="w-full" variant={mode === 'urgent' ? 'danger' : 'primary'} disabled={!cart.length} onClick={onCheckout}>
        {mode === 'urgent' ? <Zap size={16} aria-hidden /> : <ClipboardList size={16} aria-hidden />}Place {mode === 'urgent' ? 'rush ' : ''}order
      </Button>
      <p className="text-center text-[11px] text-slate-500">Demo order: no payment is taken.</p>
    </div>
  );
}

function MyOrders({ stallId }: { stallId: number }) {
  const live = useLive();
  const mine = live.orders.filter((o) => o.stallId === stallId);
  if (!mine.length) return <Card><p className="text-sm text-slate-600">No live orders yet today. Place one from <b>Order</b>, then open the Farm view in another tab to move it along.</p></Card>;
  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {mine.map((o) => (
        <Card key={o.id}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{o.id} {o.mode === 'urgent' && <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">RUSH</span>}</p>
              <p className="text-xs text-slate-600">{orderKg(o)} kg · {o.lines.map((l) => PRODUCTS[l.product].local).join(', ')} · due {date(o.deliverBy)} {time(o.deliverBy)}</p>
            </div>
            <div className="text-right"><StageBadge stage={o.stage} /><p className="tabular mt-1 text-sm font-bold text-ink">{rm(o.price.total)}</p></div>
          </div>
          <StageTrack order={o} />
        </Card>
      ))}
    </div>
  );
}

function StallHistory({ stallId }: { stallId: number }) {
  const rows = getHistory().filter((o) => o.stallId === stallId).reverse();
  const totalKg = rows.reduce((t, o) => t + orderKg(o), 0);
  const total = rows.reduce((t, o) => t + o.price.total, 0);
  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-slate-600">Orders (60 days)</p><p className="tabular text-xl font-bold text-ink">{rows.length}</p></Card>
        <Card><p className="text-xs text-slate-600">Volume</p><p className="tabular text-xl font-bold text-ink">{kg(totalKg)}</p></Card>
        <Card><p className="text-xs text-slate-600">Spend</p><p className="tabular text-xl font-bold text-ink">{rm(total)}</p></Card>
      </div>
      <Card className="overflow-x-auto p-0 md:p-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-600"><tr><th className="p-3">Date</th><th className="p-3">Order</th><th className="p-3">Product</th><th className="p-3 text-right">kg</th><th className="p-3 text-right">Total</th><th className="p-3">Delivery</th></tr></thead>
          <tbody>
            {rows.slice(0, 40).map((o) => (
              <tr key={o.id} className="border-t border-slate-200">
                <td className="p-3 text-slate-700">{date(o.stageAt.delivered!)}</td>
                <td className="p-3 font-mono text-xs text-slate-600">{o.id}</td>
                <td className="p-3">{PRODUCTS[o.lines[0].product].local}{o.mode === 'urgent' && <span className="ml-1 text-[10px] text-amber-700">RUSH</span>}</td>
                <td className="tabular p-3 text-right">{orderKg(o)}</td>
                <td className="tabular p-3 text-right">{rm(o.price.total)}</td>
                <td className={cx('p-3 text-xs', o.onTime ? 'text-emerald-700' : 'text-amber-700')}>{o.onTime ? 'On time' : 'Late'} · {o.turnaroundMin} min</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm text-slate-600">This stall has not ordered from the farm in the last 60 days.</p>}
      </Card>
    </div>
  );
}
