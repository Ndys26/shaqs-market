# SHAQs Market

Ordering app for SHAQs (Sustainable Husbandry Aquaponic System), Kuala Nerus, Terengganu.
The Telaga Batin community farm sells fresh tilapia, tilapia pekasam and aquaponic vegetables to an 11-stall cafeteria.
Runs fully in the browser. No server, no database, no online payment.

## Run

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages (free)

1. Push this folder to a GitHub repository, on branch `main`.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` builds and publishes through `.github/workflows/deploy.yml`.

`vite.config.ts` uses `base: './'`, so the site works under any repository name.

## Accounts

Sign in with the email or the user ID. Passwords are kept by the SHAQs team, not in this repository.

| Role | User ID | Email | Sees |
| --- | --- | --- | --- |
| Admin (SHAQs Market) | `admin` | `admin@shaqsmarket.my` | Dashboard, Farm and Cafe screens |
| Farm | `ladang` | `ladang@shaqsmarket.my` | Harvest log and order queue |
| Cafe stall 1–11 | `gerai01` … `gerai11` | `gerai01@shaqsmarket.my` … `gerai11@shaqsmarket.my` | Ordering for that stall |

New stalls can register from the sign-in page. Those accounts are saved in that browser only.
Emails are sign-in names only: no mail is sent.

To change a password, put the output of `hashPassword('new password')` (`src/accounts.ts`) in place of the old hash.

## Data

- `src/mockData.ts` builds 60 days of history (weekdays only) from a fixed seed, so every device shows the same numbers.
- About 1,000 kg over ~42 trading days (~24 kg/day), 9 of 11 stalls buy, ~96% on time.
- Price bands are estimates: tilapia RM 12–15/kg, pekasam RM 28–34/kg, vegetables RM 8–12/kg.
  Replace them with SHAQs' real selling prices in `PRODUCTS` (`src/mockData.ts`).
- Logos in `public/` come from the SHAQs Laporan Fasa 3 report.

## Language

English and Bahasa Melayu (Malaysia), switched with the EN / BM toggle. All text lives in `src/i18n.ts`.
The site has a web app manifest, so phones can add it to the home screen.

## Limits

- Live sync is same-browser only. Two separate devices do not share new orders.
  To sync across devices, add a Supabase or Firebase listener in `src/store.ts`.
- Sign-in runs in the browser. Passwords are stored as hashes, but a determined person can bypass the check.
  Use real authentication (for example Supabase or Firebase Auth) before real money or personal data.
- Urgent pricing is a transparent rule set (`src/pricing.ts`), not a trained model.
