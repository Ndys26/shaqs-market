# SHAQs Market (static prototype)

Ordering app for SHAQs (Sustainable Husbandry Aquaponic System), Kuala Nerus, Terengganu.
The Telaga Batin community farm sells fresh tilapia, tilapia pekasam and aquaponic vegetables to an 11-stall cafeteria.
Runs fully in the browser. No server, no database, no payment.

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

## Logins (demo only)

| Login | Username | Password | Sees |
| --- | --- | --- | --- |
| Cafe | `stall1` … `stall11` | `cafe123` | Ordering for that stall |
| Farm | `farm` | `farm123` | Harvest log and order queue |
| Admin (SHAQs Market) | `admin` | `admin123` | Dashboard, Farm and Cafe screens |

Each login screen also has **Quick demo login**. Cafe can also use simulated Google sign-in or register a stall.
Each browser tab keeps its own login. Tabs in the same browser share live orders through `localStorage`.

## Data

- `src/mockData.ts` builds 60 days of history (weekdays only) from a fixed seed, so every device shows the same numbers.
- About 1,000 kg over ~42 trading days (~24 kg/day), 9 of 11 stalls buy, ~96% on time.
- Price bands are demo estimates: tilapia RM 12–15/kg, pekasam RM 28–34/kg, vegetables RM 8–12/kg.
  Replace them with SHAQs' real selling prices in `PRODUCTS` (`src/mockData.ts`).
- Logos in `public/` come from the SHAQs Laporan Fasa 3 report.

## Limits

- Live sync is same-browser only. Two separate devices do not share new orders.
  To sync across devices, add a Supabase or Firebase listener in `src/store.ts`.
- Sign-in is for the demo only. Passwords sit in the site's JavaScript, so anyone can read them.
  Use real authentication (for example Supabase or Firebase Auth) before real users or real money.
- Google sign-in is simulated. No Google account is contacted.
- Urgent pricing is a transparent rule set (`src/pricing.ts`), not a trained model.
