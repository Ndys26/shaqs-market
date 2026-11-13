import type { Session } from './types';
import { STALLS } from './mockData';
import { tr } from './i18n';
import { addCafe } from './cafes';

/**
 * Accounts and sign-in.
 * Passwords are stored only as salted SHA-256 hashes, never as plain text.
 * shortcut: checks run in the browser of a static site, so a determined person can bypass them;
 * move sign-in to a backend (Supabase or Firebase Auth) before handling real money or personal data.
 * New cafe registrations are saved in this browser only.
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

// Password hashes for kafe01 … kafe11.
const CAFE_HASHES = [
  '0cf8e497a13b42d85f3c2a1b5373dcb1e23008d11320258959db554528961d30',
  'ff13e604faca84ba497d84cb3eb72fb97315bd35e68366322fb3d5dafa80372f',
  '8b9b0ff3c55a59ffa13d17be422499676756265259be8ae2e843341e7ffea6f7',
  'c7e1b3a6e3de3700b3ddff57e031abe73b852fe54df418fb0c2e5bc62fb1ed71',
  '2fac92bf03d378ad963490d2f0c705c9b327e02413910daed1679186eb9ba681',
  '316c51d587de0cd47a6231f0ba200db325f3b02842ab4862587339188a03978b',
  'a9d564064f14d919d2fac5f8b5c2da7f48da35c68df205ae082f4e53093d7060',
  'a937ebfd1f0b2b9e2e1adaa3744d3e83153cf36bf9a4759f8b8e35ea76883f90',
  'b15be978ba04639560bf736283e07d528169b997ba260aa2b73869b46ef29760',
  '4070b95ab3f452a0b8b37a940628115f9985ba3a1724cd84194b7a4ac7c06383',
  '87d3d86a2f162f165679ae6723c67efbe34ad3058ab6fc433d739394e0f05e1b',
];

// Telaga Batin aquaponic participants (Laporan Fasa 3). Short names only: no surname, IC, phone or address.
// shortcut: all farm logins share one password; give each participant their own before real use.
const FARM_HASH = '276588efbeca7a90b92cb49143f68a50874b36952fd90331e9a0de4cdb4f9867';
const PARTICIPANTS: [username: string, name: string][] = [
  ['lukman', 'Mohd Lukman'], ['faariza', 'Nurul Faariza'], ['suzana', 'Suzana'], ['sofiyuddib', 'Muhammad Sofiyuddib'],
  ['zawiyah', 'Zawiyah'], ['mohdnor', 'Mohd Nor'], ['tahar', 'Mohammad Tahar'], ['aisyah', 'Aisyah'],
  ['aklima', 'Aklima'], ['arif', 'Mohd Arif'], ['amirulhazim', 'Mohd Amirul Hazim'], ['fatimah', 'Tn Fatimah'],
  ['zalekha', 'Zalekha'], ['abusyawal', 'Abu Syawal'], ['nurlinda', 'Nur Linda'], ['khairol', 'Mohd Khairol Adha'],
  ['afandi', 'Mohd Afandi'], ['sahla', 'Nur Sahla Zahra'], ['tahirah', 'Tahirah'], ['norzuraini', 'Norzuraini'],
];

const BUILT_IN: Account[] = [
  { username: 'admin', email: `admin@${DOMAIN}`, passwordHash: '87d82c0eed71d1c45a67fe2c303da689505f9aa6c91b417f6fb97396a2cf7859', session: { role: 'admin', name: 'SHAQs Market Admin', method: 'password', stallId: 4 } },
  ...PARTICIPANTS.map(([username, name]) => ({ username, email: `${username}@${DOMAIN}`, passwordHash: FARM_HASH, session: { role: 'farm' as const, name, method: 'password' as const, stallId: 4 } })),
  ...STALLS.slice(0, CAFE_HASHES.length).map((s, i) => {
    const n = String(s.id).padStart(2, '0');
    return { username: `kafe${n}`, email: `kafe${n}@${DOMAIN}`, passwordHash: CAFE_HASHES[i], session: { role: 'cafe' as const, name: s.owner, method: 'password' as const, stallId: s.id } };
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

export async function registerStall(f: { cafeName: string; cuisine: string; name: string; email: string; password: string }): Promise<Session> {
  const email = f.email.trim().toLowerCase();
  if (!f.name.trim()) throw new Error(tr('err.name'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(tr('err.email'));
  if (f.password.length < 8) throw new Error(tr('err.pwLen'));
  if (!f.cafeName.trim()) throw new Error(tr('err.stall'));
  if (allAccounts().some((a) => a.email === email || a.username === email)) throw new Error(tr('err.taken'));
  const passwordHash = await hashPassword(f.password);
  try {
    const stallId = addCafe({ name: f.cafeName, cuisine: f.cuisine, owner: f.name });
    const session: Session = { role: 'cafe', name: f.name.trim(), method: 'register', stallId };
    localStorage.setItem(REG_KEY, JSON.stringify([...registered(), { username: email, email, passwordHash, session }]));
    return session;
  } catch {
    throw new Error(tr('err.storage'));
  }
}
