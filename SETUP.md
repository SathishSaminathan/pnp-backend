# PNP full setup

Data is stored in **Postgres**. Users live in a real `users` table (phone unique, block flags, profile). Other collections are synced into Postgres as well.

Live API (current):

- Health: `https://pnp-backend-production-623c.up.railway.app/health`
- Base URL for the app: `https://pnp-backend-production-623c.up.railway.app/api`

If Railway gives you a new domain, update this file and `pnp-mobile/constants/api.js`.

---

## 1. What you need

- Node.js 18+ (20 recommended)
- Yarn
- GitHub account
- Railway account (Hobby is enough for Postgres)
- Xcode and/or Android Studio for the mobile app

---

## 2. Local backend

```bash
cd pnp-backend
cp .env.example .env
docker compose up -d
yarn
yarn dev
```

Server: `http://localhost:4000`  
Health: `http://localhost:4000/health`

`.env` (never commit this file):

```
PORT=4000
DATABASE_URL=postgres://pnp:pnp@localhost:5432/pnp
JWT_SECRET=change-this-pnp-jwt-secret
JWT_EXPIRES_IN=7d
REFRESH_EXPIRES_IN=30d
DEV_OTP=123456
```

On first run the API creates tables and seeds users (or imports `data/db.json` if it exists).

### Demo login

| Phone | Notes |
| --- | --- |
| `9876543210` | Seeded user (Priya Raman), profile complete |
| Any number ending in `0000` | New user; must complete profile |

OTP for all numbers: **`123456`**

### Admin (web)

| Email | Password |
| --- | --- |
| `admin@pnp.app` | `Admin@123` |

Set the same values in `.env` as `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Run `pnp-web-admin` with `yarn dev` (proxies `/api` to `http://localhost:4000`).

1. `POST /api/auth/otp` with `{ "phone": "9876543210" }`
2. `POST /api/auth/otp/verify` with `{ "phone", "otp": "123456", "requestId" }`

---

## 3. Local mobile app

```bash
cd pnp-mobile
yarn
yarn p-i          # iOS pods
yarn start        # Metro
yarn ios          # or yarn android
```

API URL lives in `pnp-mobile/constants/api.js`:

```js
export const PNP_API_BASE_URL = 'https://pnp-backend-production-623c.up.railway.app/api';
```

| Where you run the app | `PNP_API_BASE_URL` |
| --- | --- |
| Real device (recommended) | Railway HTTPS URL above |
| iOS simulator + local API | `http://localhost:4000/api` |
| Android emulator + local API | `http://10.0.2.2:4000/api` |
| Real device + laptop API | `http://YOUR_LAN_IP:4000/api` (same Wi‑Fi only) |

`localhost` on a physical phone is the **phone**, not your computer. Use Railway for testers.

After changing the URL, reload Metro (`yarn start --reset-cache`) and rebuild if the app was already installed.

---

## 4. Push backend to GitHub

`pnp-backend` is its own git repo. Push **this folder only**.

```bash
cd pnp-backend
git remote add origin https://github.com/YOUR_USER/pnp-backend.git
git push -u origin master
```

Do not commit `.env` or `data/*.json`.

---

## 5. Deploy on Railway

1. Open [https://railway.com/new](https://railway.com/new) and sign in with GitHub.
2. **Deploy from GitHub repo** → select `pnp-backend`.
3. Railway detects Node via `package.json` and `yarn.lock`.

If the first deploy fails, set **Settings → Deploy → Custom Start Command**:

```text
yarn start
```

Do **not** set `PORT`. Railway injects it. The app already listens on `0.0.0.0`.

### Environment variables

Service → **Variables**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Variable reference from the Postgres service (see section 6) |
| `JWT_SECRET` | Long random string (not the local default) |
| `JWT_EXPIRES_IN` | `7d` |
| `REFRESH_EXPIRES_IN` | `30d` |
| `DEV_OTP` | `123456` (demo only) |
| `NODE_ENV` | `production` |

Save so Railway redeploys.

### Public URL

1. Service → **Settings → Networking → Generate Domain**
2. You get `https://<name>.up.railway.app`
3. Check `https://<name>.up.railway.app/health`
4. App base URL is `https://<name>.up.railway.app/api`

Every `git push` to the connected branch redeploys.

---

## 6. Postgres on Railway

Tables live on the **Postgres** service, not on `pnp-backend`. The API only talks to Postgres through `DATABASE_URL`.

The canvas should have **exactly two** online services:

- **Postgres** (green / Online), with **postgres-volume** attached under it
- **pnp-backend** (green / Online)

Do **not** attach a volume to `pnp-backend`. That old `/app/data` disk was for `db.json` and is unused now.

### Add Postgres (if it is missing)

1. Open the **project canvas** (the page with service boxes).
2. Click empty space → **Create** / **Add** → **Database** → **PostgreSQL**.
3. Wait until **Postgres** is **Online**. Railway creates `postgres-volume` on that service automatically. Leave it attached.

### Where to get `DATABASE_URL`

You get it from **Postgres**, not from `pnp-backend`. Do **not** use the local value `postgres://pnp:pnp@localhost:5432/pnp`.

**Preferred (no password copy):**

1. Click **Postgres** → **Variables**. Railway already has `DATABASE_URL` there.
2. Click **pnp-backend** → **Variables** → **New variable**.
3. Name: `DATABASE_URL`
4. Value: **Add a variable reference** (shared / reference) → **Postgres** → **`DATABASE_URL`**.
5. Railway stores it as `${{Postgres.DATABASE_URL}}`. That is correct.
6. Save so `pnp-backend` redeploys.

**To inspect the raw string only:** Postgres → **Variables** or **Connect**. It looks like `postgresql://postgres:PASSWORD@host:port/railway`. Paste that only if the variable reference UI is unavailable.

After a successful deploy, `https://<your-api>.up.railway.app/health` should include `"database":"postgres"`.

### Where to see table data

1. Click the **Postgres** card (not `pnp-backend`).
2. Open the **Data** tab.
3. Click **`users`** to see every OTP account (phone, name, blocked, profile).
4. Other tables: `toilets`, `bookings`, `reviews`, `notifications`, `transactions`, `master_data`.

`pnp-backend` has Deployments / Variables / Settings only. It has **no** table browser.

Optional SQL editor: enable **Raw SQL Query Tab** at [railway.com/account/feature-flags](https://railway.com/account/feature-flags), then run `SELECT * FROM users;`.

Local laptop rows are a **different** database. Railway **Data** only shows Railway Postgres after the API has booted with `DATABASE_URL`.

### Clean up extras (duplicate Postgres / leftover volumes)

If the canvas has extra boxes:

| Keep | Remove |
| --- | --- |
| **Postgres** (Online) + its nested **postgres-volume** | Extra Postgres cards (e.g. `Postgres-t7Lu`) |
| **pnp-backend** | Disconnected **postgres-volume-…** from a deleted database |
| | **pnp-backend-volume** (old JSON disk) |

1. Wait until **Applying changes** finishes if a service already says **Removed**.
2. Click each leftover volume → **Settings** or right-click → **Delete**.
3. Confirm only **Postgres** + **pnp-backend** remain.
4. **Do not** detach **postgres-volume** under the live **Postgres** service. That is the real database disk.

To disconnect the old API volume: canvas → right-click **pnp-backend-volume** → **Disconnect**, then delete it. Redeploy `pnp-backend`.

---

## 7. Demo for ~10 users

1. Backend is live on Railway with Postgres (`DATABASE_URL`).
2. Mobile `PNP_API_BASE_URL` is the Railway `/api` URL.
3. Testers install the app and log in with their phone number + OTP `123456`.
4. Share the seeded number `9876543210` if you want a ready-made host listing.

---

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| Phone cannot log in | App still pointing at `localhost`. Set Railway URL and reload. |
| First request is slow | Railway Hobby stays up; if you used a sleeping host, wait 30–60s and retry. |
| `/health` fails | Open Railway **Deployments** and **Logs**. Confirm start command `yarn start`. |
| Data vanished after deploy | `DATABASE_URL` missing, pointing at localhost, or a brand-new empty Postgres. |
| No **Data** / tables in the dashboard | You are on `pnp-backend`. Open the **Postgres** service → **Data**. |
| `DATABASE_URL` unknown | Postgres → **Variables** → `DATABASE_URL`, then reference it on `pnp-backend` (section 6). |
| OTP rejected | `DEV_OTP` on Railway must match what testers enter (`123456`). |
| Build fails | Confirm repo root is `pnp-backend` (has `package.json`). |

---

## 9. API endpoints

See [README.md](./README.md) for the full route table. Quick checks:

```bash
curl https://pnp-backend-production-623c.up.railway.app/health
```

```bash
curl -X POST https://pnp-backend-production-623c.up.railway.app/api/auth/otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210"}'
```
