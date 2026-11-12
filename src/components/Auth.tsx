import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ChefHat, Fish, KeyRound, Loader2, ShieldCheck, Store, Tractor, UserRound, Zap } from 'lucide-react';
import type { Role, Session } from '../types';
import { STALLS } from '../mockData';
import { Button, cx } from './ui';

/**
 * Demo accounts. This is a static site, so these checks run in the browser and anyone can read them.
 * shortcut: not real security; move sign-in to a backend (Supabase/Firebase Auth) before real users or real money.
 */
const ACCOUNTS: { username: string; password: string; session: Session }[] = [
  { username: 'admin', password: 'admin123', session: { role: 'admin', name: 'Sharks Market Admin', method: 'password', stallId: 4 } },
  { username: 'farm', password: 'farm123', session: { role: 'farm', name: 'Farm & Harvest Team', method: 'password', stallId: 4 } },
  ...STALLS.map((s) => ({
    username: `stall${s.id}`,
    password: 'cafe123',
    session: { role: 'cafe' as const, name: `${s.owner} · Stall #${s.id}`, method: 'password' as const, stallId: s.id },
  })),
];

const ROLES: { id: Role; label: string; icon: typeof Fish; hint: string; demoUser: string }[] = [
  { id: 'cafe', label: 'Cafe', icon: ChefHat, hint: 'stall1 … stall11 / cafe123', demoUser: 'stall4' },
  { id: 'farm', label: 'Farm', icon: Tractor, hint: 'farm / farm123', demoUser: 'farm' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, hint: 'admin / admin123', demoUser: 'admin' },
];

// Simulated Google accounts for cafe owners. Nothing is sent to Google.
const GOOGLE_DEMO = [4, 7, 11].map((id) => {
  const s = STALLS.find((x) => x.id === id)!;
  return { email: `stall${String(id).padStart(2, '0')}@kafe-demo.test`, session: { role: 'cafe' as const, name: `${s.owner} · Stall #${id}`, method: 'google' as const, stallId: id } };
});

const input = 'mt-1 min-h-11 w-full rounded-xl border border-slate-600/60 bg-ocean-2 px-3 text-white placeholder:text-slate-500';

export function AuthScreen({ onDone }: { onDone: (s: Session) => void }) {
  const [role, setRole] = useState<Role>('cafe');
  const [view, setView] = useState<'login' | 'google' | 'register'>('login');
  const [cred, setCred] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reg, setReg] = useState({ name: '', license: '', phone: '', stallId: 4 });

  const finish = (s: Session, key: string) => {
    setBusy(key);
    setTimeout(() => onDone(s), 500);
  };

  const login = (username: string, password: string) => {
    const acc = ACCOUNTS.find((a) => a.username === username.trim().toLowerCase() && a.password === password);
    if (!acc) return setError('Wrong username or password.');
    if (acc.session.role !== role) return setError(`That account is not a ${ROLES.find((r) => r.id === role)!.label} account.`);
    setError('');
    finish(acc.session, 'login');
  };

  const demo = () => {
    const acc = ACCOUNTS.find((a) => a.username === ROLES.find((r) => r.id === role)!.demoUser)!;
    finish({ ...acc.session, method: 'demo' }, 'demo');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-md rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-electric to-fresh"><Fish className="text-white" aria-hidden /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Sharks Market</h1>
            <p className="text-sm text-slate-400">Farm-to-kitchen aquaculture supply</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Sign in as">
          {ROLES.map((r) => (
            <button key={r.id} role="tab" aria-selected={role === r.id} disabled={!!busy}
              onClick={() => { setRole(r.id); setView('login'); setError(''); setCred({ username: '', password: '' }); }}
              className={cx('relative flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold', role === r.id ? 'text-ocean' : 'text-slate-300')}>
              {role === r.id && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-fresh" transition={{ type: 'spring', duration: 0.35 }} />}
              <r.icon size={16} className="relative" aria-hidden /><span className="relative">{r.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div key={`login-${role}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); login(cred.username, cred.password); }}>
                <label className="block text-sm"><span className="text-slate-300">Username</span>
                  <input autoComplete="username" value={cred.username} onChange={(e) => setCred({ ...cred, username: e.target.value })} className={input} placeholder={ROLES.find((r) => r.id === role)!.demoUser} /></label>
                <label className="block text-sm"><span className="text-slate-300">Password</span>
                  <input type="password" autoComplete="current-password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} className={input} /></label>
                {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
                <Button type="submit" variant="blue" className="w-full" disabled={!!busy}>
                  {busy === 'login' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <KeyRound size={18} aria-hidden />}Sign in
                </Button>
              </form>

              {role === 'cafe' && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setView('google')} disabled={!!busy} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-bold text-sky-600">G</span>Google
                  </button>
                  <Button variant="ghost" onClick={() => setView('register')} disabled={!!busy}><Store size={16} aria-hidden />Register stall</Button>
                </div>
              )}

              <Button className="w-full" onClick={demo} disabled={!!busy}>
                {busy === 'demo' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Zap size={18} aria-hidden />}Quick demo login
              </Button>
              <p className="text-center text-xs text-slate-500">Demo: {ROLES.find((r) => r.id === role)!.hint}</p>
            </motion.div>
          )}

          {view === 'google' && (
            <motion.div key="google" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="mb-3 text-sm text-slate-300">Choose an account <span className="text-slate-500">(simulated Google sign-in)</span></p>
              {GOOGLE_DEMO.map((a) => (
                <button key={a.email} disabled={!!busy} onClick={() => finish(a.session, a.email)}
                  className={cx('flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-600/50 px-3 text-left hover:bg-white/5', busy === a.email && 'border-emerald-400')}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-electric/30"><UserRound size={18} aria-hidden /></span>
                  <span className="flex-1"><span className="block text-sm font-semibold text-white">{a.session.name}</span><span className="block text-xs text-slate-400">{a.email}</span></span>
                  {busy === a.email && <Loader2 className="animate-spin text-emerald-400" size={18} aria-label="Signing in" />}
                </button>
              ))}
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setView('login')} disabled={!!busy}>Back</Button>
            </motion.div>
          )}

          {view === 'register' && (
            <motion.form key="reg" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); if (reg.name.trim()) finish({ role: 'cafe', name: `${reg.name.trim()} · Stall #${reg.stallId}`, method: 'register', stallId: reg.stallId }, 'reg'); }}>
              <label className="block text-sm"><span className="text-slate-300">Stall</span>
                <select value={reg.stallId} onChange={(e) => setReg({ ...reg, stallId: Number(e.target.value) })} className={input}>
                  {STALLS.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.name} ({s.cuisine})</option>)}
                </select></label>
              {([['name', 'Owner name', 'text', 'Puan Zakiah'], ['license', 'Licence no.', 'text', 'PBT-KF-0104'], ['phone', 'Owner phone', 'tel', '012-345 6789']] as const).map(([k, label, type, ph]) => (
                <label key={k} className="block text-sm"><span className="text-slate-300">{label}{k === 'name' && ' *'}</span>
                  <input required={k === 'name'} type={type} placeholder={ph} value={reg[k]} onChange={(e) => setReg({ ...reg, [k]: e.target.value })} className={input} /></label>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => setView('login')} disabled={!!busy}>Back</Button>
                <Button type="submit" className="flex-1" disabled={!!busy}>Register & enter</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-5 flex items-start gap-2 text-xs text-slate-400"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />Prototype: sign-in is for the demo only. Data stays in this browser.</p>
      </motion.div>
    </div>
  );
}
