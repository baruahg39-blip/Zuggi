# Zuggi Freight Logistics Platform

Full-stack freight marketplace, fleet dispatch, live GPS tracking with 500m geo-fencing, Google Maps Routes API live ETA, and escrow/UPI payments.

---

## Security & Git History Warning (Read Before Deploying)

> **CRITICAL — ROTATE PREVIOUSLY HARDCODED SECRETS IMMEDIATELY**
>
> Earlier revisions of this repository contained hardcoded credentials in source files. Even though all secrets have been removed from the current codebase and moved to environment variables, **any value that was ever committed remains readable in Git history**.
>
> Before deploying to production or sharing this repository, you **must**:
> 1. **Rotate your httpSMS API key (`HTTPSMS_API_KEY`)** in your httpSMS dashboard and revoke the previously exposed key immediately.
> 2. **Set a fresh, strong `ZUGGI_ADMIN_PASSCODE`** (never reuse the old hardcoded passcode) in your hosting provider's secret manager.
> 3. **Configure a strong `TRACKING_TOKEN_SECRET`** (optional; if omitted the server auto-generates a fresh random secret on every boot) so older signed tracking tokens are invalidated.
> 4. **Verify your GCP API key restrictions**: restrict `VITE_GOOGLE_MAPS_API_KEY` and the Firebase Web API key in `firebase-applet-config.json` by HTTP referrer (e.g., `https://zuggi.in/*`, `https://partner.zuggi.in/*`) in Google Cloud Console, and restrict server-side `GOOGLE_MAPS_API_KEY` by IP address or API scope.
> 5. **Scrub Git history** (e.g., using `git filter-repo` or BFG Repo-Cleaner) if this repository will ever be pushed to a public or shared remote.

---

## Environment Configuration

1. Copy `.env.example` to `.env.local` (never commit `.env` or `.env.local`; `.env*` is ignored by `.gitignore`):
   ```bash
   cp .env.example .env.local
   ```
2. Populate all required secrets in `.env.local` for local development or in your deployment platform's environment variables.

### Server-Side Variables (Never Expose to Browser)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side logistics intelligence proxy (`/api/logistics-intelligence`) |
| `GOOGLE_MAPS_API_KEY` | Server-side reverse geocoding & Routes API v2 ETA calculation |
| `SUPABASE_URL` | Supabase PostgreSQL project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only; never exposed to client) |
| `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` | Cashfree Easy Split payments & HMAC webhook signature verification |
| `CASHFREE_ENVIRONMENT` / `CASHFREE_API_VERSION` | `sandbox` or `production` + API version (`2023-08-01`) |
| `HTTPSMS_API_KEY` / `MY_JIO_PHONE_NUMBER` | httpSMS gateway API key and sender mobile number for OTP & trip SMS |
| `SUPER_ADMIN_EMAIL` / `ZUGGI_ADMIN_PASSCODE` | Platform owner email and Super Admin authentication passcode |
| `TRACKING_TOKEN_SECRET` *(optional)* | Custom HMAC secret for trip tracking tokens (defaults to a random 256-bit key per boot) |

### Browser-Safe Variables (`VITE_*`)

Only non-sensitive, browser-intended values use the `VITE_` prefix:
- `VITE_GOOGLE_MAPS_API_KEY` — Public Maps JS SDK key (must be HTTP-referrer restricted in GCP Console)
- `VITE_ZUGGI_MERCHANT_UPI` & `VITE_ZUGGI_MERCHANT_NAME` — Public merchant UPI ID and display name for direct UPI checkout

---

## Database & Access Control Safeguards

- **Supabase Row Level Security (RLS):** Every table in `supabase/schema.sql` (`vs_users`, `vs_vehicles`, `vs_loads`, `vs_quotations`, `vs_bookings`, `vs_support_tickets`, `vs_trips`, `vs_location_pings`) has `ENABLE ROW LEVEL SECURITY` with no anonymous client policies. All database access runs strictly through the Express server using `SUPABASE_SERVICE_ROLE_KEY`.
- **Firebase Web Config & Firestore Rules:** `firebase-applet-config.json` stores Firebase's public web app identifier (required by the Firebase Web SDK). Access is governed by default-deny rules in `firestore.rules` enforcing authenticated ownership and platform owner checks.
- **Super Admin First-Run Protection:** If `ZUGGI_ADMIN_PASSCODE` is not set in local preview, the Super Admin portal prompts once to set an 8+ character passcode (hashed server-side with `scrypt`) and locks setup permanently. Setting `ZUGGI_ADMIN_PASSCODE` always takes precedence in production.

---

## Running Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm start
```
