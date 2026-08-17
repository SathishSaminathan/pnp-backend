# PNP full setup

This guide covers local development, Railway hosting (for real phones), and connecting `pnp-mobile`. Data is stored in `data/db.json`. **Postgres is not used** and is not required for a ~10 person demo.

Live API (current):

- Health: `https://pnp-backend-production-623c.up.railway.app/health`
- Base URL for the app: `https://pnp-backend-production-623c.up.railway.app/api`

If Railway gives you a new domain, update this file and `pnp-mobile/constants/api.js`.

---

## 1. What you need

- Node.js 18+ (20 recommended)
- Yarn
- GitHub account
- Railway account (Hobby plan if you want a persistent volume)
- Xcode and/or Android Studio for the mobile app

---

## 2. Local backend

```bash
cd pnp-backend
cp .env.example .env
yarn
yarn dev
```

Server: `http://localhost:4000`  
Health: `http://localhost:4000/health`

`.env` (never commit this file):

```
PORT=4000
JWT_SECRET=change-this-pnp-jwt-secret
JWT_EXPIRES_IN=7d
REFRESH_EXPIRES_IN=30d
DEV_OTP=123456
```

On first run the API creates `data/db.json` from seed data.

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

## 6. Persistent volume (keep testers’ data)

Without a volume, `db.json` is wiped on deploy/restart.

Railway does **not** put this under Service → Settings. Use the **project canvas** (the page with service boxes):

1. Open the **project** (canvas), not only the service Variables tab.
2. **Right-click empty space** → **Add Volume**, or press **⌘K** / **Ctrl+K** and type **Volume**.
3. Attach it to the **pnp-backend** service.
4. **Mount path:** `/app/data` (must start with `/`).
5. Wait for the automatic redeploy to succeed.

Volumes usually need a **Hobby** (paid) workspace. Trial/free often hides **Add Volume**.

Confirm in logs that the API started, then hit `/health` again.

---

## 7. Demo for ~10 users

Postgres is **not** needed.

1. Backend is live on Railway with a volume at `/app/data`.
2. Mobile `PNP_API_BASE_URL` is the Railway `/api` URL.
3. Testers install the app and log in with their phone number + OTP `123456`.
4. Share the seeded number `9876543210` if you want a ready-made host listing.

Add Postgres later only for a public launch, backups, or much more traffic. The API does not read `DATABASE_URL` today; adding a Postgres plugin on Railway does nothing until the code is migrated.

---

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| Phone cannot log in | App still pointing at `localhost`. Set Railway URL and reload. |
| First request is slow | Railway Hobby stays up; if you used a sleeping host, wait 30–60s and retry. |
| `/health` fails | Open Railway **Deployments** and **Logs**. Confirm start command `yarn start`. |
| Data vanished after deploy | Volume missing or mount path not `/app/data`. |
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
