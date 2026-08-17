# PNP backend

API for the PNP mobile app. Seed data matches `pnp-mobile/services/pnpMockData.js`.

## Setup

```bash
cd pnp-backend
cp .env.example .env
yarn
yarn dev
```

The server listens on `http://localhost:4000`.

## OTP login

1. `POST /api/auth/otp` with `{ "phone": "9876543210" }`
2. Enter the demo OTP `123456` (returned as `mockOtp` in development)
3. `POST /api/auth/otp/verify` with `{ "phone", "otp", "requestId" }`

Numbers ending in `0000` create a new user and skip profile completion until `PUT /api/profile`.

Default seeded user: **9876543210** (Priya Raman, profile complete, owns Central Metro Comfort Hub).

## Mobile app

`pnp-mobile` points at:

- iOS simulator: `http://localhost:4000/api`
- Android emulator: `http://10.0.2.2:4000/api`

On a physical device, set `PNP_API_BASE_URL` in `pnp-mobile/constants/api.js` to your machine LAN IP.

## Endpoints

| Method | Path | Auth | Used by |
| --- | --- | --- | --- |
| POST | `/api/auth/otp` | no | Mobile login |
| POST | `/api/auth/otp/verify` | no | OTP screen |
| GET/PUT | `/api/profile` | yes | Profile / setup |
| POST | `/api/home/feed` | yes | Home |
| POST | `/api/toilets/search` | yes | Home, Search, Toilets, Favorites |
| GET | `/api/toilets/filters` | yes | Discovery filters |
| GET | `/api/toilets/mine` | yes | My toilets, Earnings, Profile |
| GET | `/api/toilets/:id` | yes | Toilet details |
| POST | `/api/toilets/:id/favorite` | yes | Favorites toggle |
| POST/PUT | `/api/toilets` / `/api/toilets/:id` | yes | Add / edit listing |
| GET | `/api/toilets/:id/bookings` | yes | Listing bookings |
| GET | `/api/bookings` | yes | Bookings, History |
| GET | `/api/bookings/:id` | yes | Booking details, payment success |
| POST | `/api/bookings/:id/reviews` | yes | Review flow |
| POST | `/api/payments/quote` | yes | Checkout |
| POST | `/api/payments/orders` | yes | Create payment |
| POST | `/api/payments/verify` | yes | Confirm payment |
| GET | `/api/earnings` | yes | Earnings |
| GET | `/api/earnings/transactions` | yes | Transactions |
| GET | `/api/reviews` | yes | Reviews |
| GET | `/api/notifications` | yes | Notifications |

Data is stored in `data/db.json` after the first run.
