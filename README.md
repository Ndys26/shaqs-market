# Sharks Market (static prototype)

Farm-to-kitchen aquaculture ordering for an 11-stall government cafeteria pilot.
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
| Admin (Sharks Market) | `admin` | `admin123` | Dashboard, Farm and Cafe screens |

Each login screen also has **Quick demo login**. Cafe can also use simulated Google sign-in or register a stall.
Each browser tab keeps its own login. Tabs in the same browser share live orders through `localStorage`.

## Data

- `src/mockData.ts` builds 60 days of history (weekdays only) from a fixed seed, so every device shows the same numbers.
- About 1,200 kg over ~44 trading days (~27 kg/day), 8 of 11 stalls buy fish, ~95% on time.
- Prices stay inside RM 12–15 (tilapia), RM 20–24 (siakap), RM 13–17 (patin) per kg.

## Limits

- Live sync is same-browser only. Two separate devices do not share new orders.
  To sync across devices, add a Supabase or Firebase listener in `src/store.ts`.
- Sign-in is for the demo only. Passwords sit in the site's JavaScript, so anyone can read them.
  Use real authentication (for example Supabase or Firebase Auth) before real users or real money.
- Google sign-in is simulated. No Google account is contacted.
- Urgent pricing is a transparent rule set (`src/pricing.ts`), not a trained model.
