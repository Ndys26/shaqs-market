import type { Session } from './types';
import { STALLS } from './mockData';

/**
 * Accounts and sign-in.
 * Passwords are stored only as salted SHA-256 hashes, never as plain text.
 * shortcut: checks run in the browser of a static site, so a determined person can bypass them;
 * move sign-in to a backend (Supabase or Firebase Auth) before handling real money or personal data.
 * New stall registrations are saved in this browser only.
 */
export interface Account {
  username: string;
  email: string;
  passwordHash: string;
  session: Session;
}

const DOMAIN = 'shaqsmarket.my';
const REG_KEY = 'shaqs-market:accounts';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`shaqs:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STALL_HASHES = [
  '99782c6fcf9e3650f83002774f7b546e11d054ffedd0035c5f9c969366ab900a',
  'caa9ab3d46fe4b5eb74038f1571d52a5a8adde7517aecd3292ebe85a1adf5dfa',
  'c9e0227af8c2b490ec313685a3fa81a50fe890a72a4269de8aa5206f1e3858e3',
  '554206b6c71decc0131b8574864deaa1aa65973ed596880ec550a4f3ae52c57b',
  'ad6d97c34369c97b9b6cc822a6174f3af09dfbe09e13ec735a37c5970c07f932',
  '99a78c20b83e882a070a75ffedf7fa850784f42c69b6d781524d0daca1cf3095',
  '8213c82b0ede0ccfbf7e1797c381a941ffdfbb930aea3775ccfd03eb35d8d921',
  '1cf63254174d09f1d8e318c9c14b2fb083d9c75649c2c98f4f24467509e8dc46',
  '9d126dae851109b1109c3c121869365bf3c4934ae8045cc114573649433209bf',
  '50914ef76088aa4c3e523df5e561e224ee3125ea1dc3c24f232898972fc786e5',
  'fabe9c5d45f6694600871427bdf00fcc7079e2829a89efeb8b7189b1d99cdd8f',
];

const BUILT_IN: Account[] = [
  { username: 'admin', email: `admin@${DOMAIN}`, passwordHash: '87d82c0eed71d1c45a67fe2c303da689505f9aa6c91b417f6fb97396a2cf7859', session: { role: 'admin', name: 'SHAQs Market Admin', method: 'password', stallId: 4 } },
  { username: 'ladang', email: `ladang@${DOMAIN}`, passwordHash: '276588efbeca7a90b92cb49143f68a50874b36952fd90331e9a0de4cdb4f9867', session: { role: 'farm', name: 'Ladang Akuaponik Telaga Batin', method: 'password', stallId: 4 } },
  ...STALLS.map((s, i) => {
    const n = String(s.id).padStart(2, '0');
    return { username: `gerai${n}`, email: `gerai${n}@${DOMAIN}`, passwordHash: STALL_HASHES[i], session: { role: 'cafe' as const, name: `${s.owner} · Gerai #${s.id}`, method: 'password' as const, stallId: s.id } };
  }),
];

function registered(): Account[] {
  try {
    const xs = JSON.parse(localStorage.getItem(REG_KEY) ?? '[]');
    return Array.isArray(xs) ? xs.filter((a) => a?.email && a?.passwordHash && a?.session?.role === 'cafe') : [];
  } catch {
    return [];
  }
}

const allAccounts = () => [...BUILT_IN, ...registered()];

export async function signIn(id: string, password: string): Promise<Session | null> {
  const key = id.trim().toLowerCase();
  const acc = allAccounts().find((a) => a.username === key || a.email === key);
  if (!acc || !password) return null;
  return acc.passwordHash === (await hashPassword(password)) ? acc.session : null;
}

export async function registerStall(f: { stallId: number; name: string; email: string; password: string }): Promise<Session> {
  const email = f.email.trim().toLowerCase();
  if (!f.name.trim()) throw new Error('Enter the owner name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
  if (f.password.length < 8) throw new Error('Password needs at least 8 characters.');
  if (!STALLS.some((s) => s.id === f.stallId)) throw new Error('Choose a stall.');
  if (allAccounts().some((a) => a.email === email || a.username === email)) throw new Error('That email already has an account.');
  const session: Session = { role: 'cafe', name: `${f.name.trim()} · Gerai #${f.stallId}`, method: 'register', stallId: f.stallId };
  const acc: Account = { username: email, email, passwordHash: await hashPassword(f.password), session };
  try {
    localStorage.setItem(REG_KEY, JSON.stringify([...registered(), acc]));
  } catch {
    throw new Error('This browser blocks saving. Turn off private mode and try again.');
  }
  return session;
}
