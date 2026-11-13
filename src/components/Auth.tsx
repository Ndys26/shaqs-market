import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { KeyRound, Loader2, Store } from 'lucide-react';
import type { Session } from '../types';
import { registerStall, signIn } from '../accounts';
import { tr as t, type Key } from '../i18n';
import { Button, LangToggle } from './ui';

const input = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink placeholder:text-slate-500';

export function AuthScreen({ onDone }: { onDone: (s: Session) => void }) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [cred, setCred] = useState({ id: '', password: '' });
  const [reg, setReg] = useState({ cafeName: '', cuisine: '', name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Session | null>, fail: string) => {
    setBusy(true);
    setError('');
    try {
      const s = await fn();
      if (s) return onDone(s);
      setError(fail);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-14">
      <LangToggle className="absolute right-4 top-4" />
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="glass w-full max-w-md rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}shaqs-logo.png`} alt="SHAQs logo" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">SHAQs Market</h1>
            <p className="text-sm text-slate-600">{t('auth.tagline')}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'login' ? (
            <motion.form key="login" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); void run(() => signIn(cred.id, cred.password), t('auth.wrong')); }}>
              <h2 className="text-lg font-bold text-ink">{t('auth.signIn')}</h2>
              <label className="block text-sm"><span className="text-slate-700">{t('auth.id')}</span>
                <input required autoComplete="username" value={cred.id} onChange={(e) => setCred({ ...cred, id: e.target.value })} className={input} /></label>
              <label className="block text-sm"><span className="text-slate-700">{t('auth.password')}</span>
                <input required type="password" autoComplete="current-password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} className={input} /></label>
              {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
              <Button type="submit" variant="blue" className="w-full" disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <KeyRound size={18} aria-hidden />}{t('auth.signIn')}
              </Button>
              <p className="pt-1 text-center text-sm text-slate-600">{t('auth.newStall')}{' '}
                <button type="button" className="font-semibold text-fresh underline-offset-2 hover:underline" onClick={() => { setView('register'); setError(''); }}>{t('auth.registerHere')}</button></p>
            </motion.form>
          ) : (
            <motion.form key="reg" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (reg.password !== reg.confirm) return setError(t('auth.mismatch'));
                void run(() => registerStall(reg), t('auth.fail'));
              }}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Store size={18} aria-hidden />{t('auth.registerTitle')}</h2>
              {([['cafeName', 'auth.stall', 'text', 'organization'], ['cuisine', 'd.cuisine', 'text', 'off'], ['name', 'auth.owner', 'text', 'name'], ['email', 'auth.email', 'email', 'email'], ['phone', 'auth.phone', 'tel', 'tel'], ['password', 'auth.newPw', 'password', 'new-password'], ['confirm', 'auth.confirm', 'password', 'new-password']] as const).map(([k, label, type, ac]) => (
                <label key={k} className="block text-sm"><span className="text-slate-700">{t(label as Key)}</span>
                  <input required={k !== 'phone' && k !== 'cuisine'} minLength={k === 'password' ? 8 : undefined} type={type} autoComplete={ac} value={reg[k]} onChange={(e) => setReg({ ...reg, [k]: e.target.value })} className={input} /></label>
              ))}
              {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => { setView('login'); setError(''); }} disabled={busy}>{t('auth.back')}</Button>
                <Button type="submit" className="flex-1" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />}{t('auth.create')}</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-center gap-4 border-t border-slate-200 pt-4">
          <span className="text-xs text-slate-500">{t('auth.for')}</span>
          <img src={`${import.meta.env.BASE_URL}ucse-usec-logo.jpg`} alt="UCSE & USEC" className="h-10 w-auto" />
          <img src={`${import.meta.env.BASE_URL}umt-logo.png`} alt="Universiti Malaysia Terengganu" className="h-10 w-auto" />
        </div>
      </motion.div>
    </div>
  );
}
