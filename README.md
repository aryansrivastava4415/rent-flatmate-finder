# Rent & Flatmate Finder

A full-stack platform where room **owners** post listings and **tenants** create
"looking for room" profiles. An LLM-powered compatibility engine scores and ranks
matches, accepted matches unlock real-time chat, and email notifications fire on
key events (high-compatibility interest, accept/decline).

## Tech Stack

| Layer       | Choice                                                                 |
|-------------|-------------------------------------------------------------------------|
| Backend     | Node.js, Express, Socket.io                                            |
| Database    | SQLite via Prisma ORM (swap to Postgres for production — see below)    |
| Auth        | JWT, bcrypt password hashing, role-based access (`TENANT`/`OWNER`/`ADMIN`) |
| AI scoring  | Anthropic Claude API, with an automatic rule-based fallback             |
| Email       | Nodemailer (any SMTP provider), falls back to console logging in dev    |
| Frontend    | React 18 + Vite, React Router, socket.io-client                        |

## Project Structure

```
backend/
  prisma/schema.prisma      # DB schema (see below)
  src/
    index.js                # Express + Socket.io entrypoint
    routes/                 # auth, tenant, listings, interests, chat, admin
    services/llm.service.js     # compatibility scoring (LLM + rule-based fallback)
    services/email.service.js   # SMTP email with dev console fallback
    sockets/chat.socket.js      # real-time chat (JWT-authenticated)
    middleware/auth.js          # JWT auth + role guard
    utils/seed.js                # seeds the admin account
frontend/
  src/
    pages/                  # AuthPage, TenantDashboard, OwnerDashboard, AdminDashboard, ChatPage
    api/client.js           # typed fetch wrapper for the REST API
    context/AuthContext.jsx # JWT/session state
```

## Setup Guide

### Prerequisites
- Node.js 18+
- npm

### 1. Backend

The schema defaults to PostgreSQL (to match the one-click Render deploy below).
For local development you have two options:

**Option A — quick local testing with SQLite (no DB setup required):**
In `backend/prisma/schema.prisma`, change `provider = "postgresql"` to
`provider = "sqlite"`, and set `DATABASE_URL="file:./dev.db"` in `.env`.

**Option B — use a local/cloud Postgres instance:** keep the schema as-is and
set `DATABASE_URL` to your Postgres connection string in `.env`.

```bash
cd backend
cp .env.example .env       # edit DATABASE_URL etc. as needed (see above)
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev                  # starts the API on http://localhost:4000
```

> Note: this repo doesn't include a `prisma/migrations` folder (it wasn't possible to generate one during development due to a network-restricted sandbox). `npx prisma migrate dev --name init` will generate it on first run in a normal environment. If you only need to sync the schema without a migration history (e.g. quick local testing), you can instead run `npx prisma db push`, which is also what the Render Blueprint uses in production.

`npx prisma generate`/`migrate` download Prisma's query engine binary on first
run, so an internet connection is required at setup time (one-time, standard
Prisma behavior).

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # VITE_API_URL should point at the backend
npm install
npm run dev                  # starts the app on http://localhost:5173
```

Visit `http://localhost:5173`, register as a Tenant or Owner, or log in as the
seeded admin (credentials from `backend/.env` → `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### Environment Variables

**backend/.env.example**
```
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL="file:./dev.db"
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Rent & Flatmate Finder <no-reply@flatmatefinder.com>"
ADMIN_EMAIL=admin@flatmatefinder.com
ADMIN_PASSWORD=Admin@12345
```
- Leave `ANTHROPIC_API_KEY` blank to run entirely on the rule-based fallback scorer.
- Leave `SMTP_*` blank to log emails to the console instead of sending them (useful for local dev/grading without setting up an SMTP account).

**frontend/.env.example**
```
VITE_API_URL=http://localhost:4000
```

## Deploying (One-Click via Render Blueprint)

This repo includes a `render.yaml` Blueprint that provisions the Postgres
database, backend, and frontend together in a single step:

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. In the [Render Dashboard](https://render.com), click **New +** → **Blueprint**.
3. Connect this repository and select the `main` branch. Render reads `render.yaml` automatically.
4. Click **Apply**. Render provisions:
   - A free Postgres database (`rent-flatmate-db`)
   - The backend web service (`rent-flatmate-backend`) — `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL` are wired automatically
   - The frontend static site (`rent-flatmate-frontend`) — `VITE_API_URL` is wired automatically to the backend's URL
5. You'll be prompted for a few secret values (marked `sync: false` in `render.yaml`): `ANTHROPIC_API_KEY` (optional — leave blank to use the rule-based fallback), `ADMIN_PASSWORD`, and SMTP credentials (optional — leave blank to log emails to console).
6. Once deployed, the backend automatically seeds the admin account on startup (no Shell access required — this also works on Render's free tier, which doesn't support Shell). Log in with `ADMIN_EMAIL` (default `admin@flatmatefinder.com`) and the `ADMIN_PASSWORD` you provided.
7. Visit the frontend's URL (shown on its Render dashboard page) — the app is live.

This avoids manually creating a database, two services, and cross-wiring environment variables by hand.

### Manual Deploy (alternative)
If you'd rather not use the Blueprint, you can create the Postgres database, backend web service, and frontend (on Render's static sites or Vercel) individually — set `rootDir`/build/start commands as shown in `render.yaml`, and wire `DATABASE_URL`, `CLIENT_URL`, and `VITE_API_URL` by hand using the values described above.

## Database Schema

- **User** — `id, email, password (hashed), name, role (TENANT/OWNER/ADMIN), isActive, createdAt`
- **TenantProfile** (1:1 with User) — `preferredLocation, budgetMin, budgetMax, moveInDate`
- **Listing** (owned by User) — `location, rent, availableFrom, roomType, furnishingStatus, photos (JSON array), status (ACTIVE/FILLED)`
- **Compatibility** (unique per tenant+listing) — `score (0-100), explanation, source (LLM/RULE_BASED)` — computed once and cached, not recomputed every request
- **Interest** (unique per tenant+listing) — `status (PENDING/ACCEPTED/DECLINED), compatScore`
- **Message** (belongs to an accepted Interest) — `senderId, content, createdAt`

Full definitions are in `backend/prisma/schema.prisma`.

## API Documentation

All endpoints are prefixed with `/api`. Authenticated routes require
`Authorization: Bearer <token>`.

| Method | Route | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register as TENANT or OWNER |
| POST | `/auth/login` | — | Log in, returns JWT |
| GET  | `/auth/me` | any | Current user |
| GET/PUT | `/tenant/profile` | TENANT | View/update preferences |
| POST | `/listings` | OWNER | Create a listing |
| GET  | `/listings/mine` | OWNER | Owner's own listings |
| GET  | `/listings?location=&budgetMax=` | TENANT | Browse, ranked by compatibility score |
| GET  | `/listings/:id` | any | Listing detail |
| PATCH| `/listings/:id` | OWNER | Edit own listing |
| PATCH| `/listings/:id/fill` | OWNER | Mark filled (hides from search) |
| POST | `/interests` | TENANT | Express interest in a listing |
| GET  | `/interests/mine` | TENANT | Own interest requests |
| GET  | `/interests/received` | OWNER | Interests on owner's listings |
| PATCH| `/interests/:id` | OWNER | Accept/decline (`{status}`) |
| GET  | `/chat` | TENANT/OWNER | List accepted chat threads |
| GET  | `/chat/:interestId/messages` | TENANT/OWNER | Message history |
| GET  | `/admin/users` | ADMIN | All users |
| PATCH| `/admin/users/:id` | ADMIN | Enable/disable a user |
| GET  | `/admin/listings` | ADMIN | All listings |
| GET  | `/admin/activity` | ADMIN | Platform stats + recent activity |

### Real-time Chat (Socket.io)
Connect with `io(API_URL, { auth: { token } })`. Events:
- `join_room({ interestId })` — joins the room (server validates the interest is ACCEPTED and the caller is a participant)
- `send_message({ interestId, content })` — persists and broadcasts to the room as `new_message`

## LLM Compatibility Scoring

**Prompt** (sent to Claude, `backend/src/services/llm.service.js`):
```
Given this room listing: {location, rent, availableFrom, roomType, furnishingStatus}
and this tenant profile: {preferredLocation, budgetMin, budgetMax, moveInDate},
compute a compatibility score from 0 to 100 based on budget and location match.
Return JSON: { score: number, explanation: string }
```

**Example input:**
```json
{
  "listing": { "location": "Koramangala, Bangalore", "rent": 18000, "roomType": "PRIVATE", "furnishingStatus": "FURNISHED" },
  "tenant":  { "preferredLocation": "Koramangala", "budgetMin": 15000, "budgetMax": 20000 }
}
```

**Example LLM output:**
```json
{ "score": 92, "explanation": "Listing is in the tenant's preferred neighborhood and the rent fits comfortably within budget." }
```

**Fallback behavior:** if `ANTHROPIC_API_KEY` is unset, the request times out (12s), the API errors, or the response isn't parseable JSON, the system automatically falls back to a deterministic rule-based score (50 pts for location substring match + up to 50 pts for budget fit) and tags the record `source: RULE_BASED`. The score and explanation are persisted in the `Compatibility` table on first computation and reused thereafter — they're only recomputed if the tenant updates their profile.

## Notifications
- Owner is emailed when a tenant expresses interest; subject line is escalated when the compatibility score exceeds 80.
- Tenant is emailed when the owner accepts or declines their interest.
- Without SMTP configured, emails are printed to the backend console (so the flow is fully testable without a mail account).
