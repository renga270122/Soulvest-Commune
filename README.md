# Soulvest Commune

Soulvest Commune is a resident-community app with resident, guard, and admin flows. The current codebase is set up primarily as a demo-friendly frontend with local browser-backed sample data, plus a separate Express backend for chatbot, notifications, visitor APIs, and Razorpay payment verification.

## Current State

- Frontend is built with React, Vite, React Router, and Material UI.
- Demo mode is active in the frontend and uses localStorage-backed sample accounts and sample society data.
- The admin dashboard includes a demo reset control to reseed the local store.
- Resident expenses now support Razorpay Checkout through a backend order and signature verification flow.
- The backend is prepared for deployment on Render using the repo-level [render.yaml](render.yaml).
- GitHub Pages is used for the static frontend deployment.

## Main App Areas

- Resident flows: announcements, expenses, complaints, directory, profile, bookings.
- Public resident feedback: a shareable `/feedback` form for WhatsApp group collection.
	The form can be submitted without name or flat number.
- Guard flows: visitor approvals and security operations.
- Admin flows: charges, announcements, facility oversight, demo reset controls.
- Backend flows: chatbot, notification dispatch, visitor endpoints, Razorpay order and verification endpoints.

## Local Frontend Setup

```bash
npm install
npm run dev
```

Optional frontend env file:

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` if you want the frontend to talk to a running backend.

## Local Backend Setup

```bash
cd backend
npm install
npm start
```

Optional backend env file:

```bash
cp .env.example .env
```

For backend startup you need either:

- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a local Firebase service account file, or
- `FIREBASE_SERVICE_ACCOUNT_JSON` containing the full service account JSON string

If Firebase credentials are missing, the backend still starts and `/health` stays available, but Firebase-backed routes return `503` until credentials are configured.

For live Razorpay payments you also need:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Deployment

- Frontend: GitHub Pages via `npm run deploy`
- Backend: Render via [render.yaml](render.yaml)

The frontend host `https://commune.soulvest.ai` is static-only. Live payments require `VITE_API_BASE_URL` to point to the deployed backend service.

## Documentation

- Backend deployment guide: [backend/README.md](backend/README.md)
- Consolidated implementation summary: [docs/change-summary-2026-04-07.md](docs/change-summary-2026-04-07.md)
- Firebase to PostgreSQL mapping: [docs/firebase-to-postgres-mapping.md](docs/firebase-to-postgres-mapping.md)
- PostgreSQL starter schema: [docs/postgresql-init.sql](docs/postgresql-init.sql)

## Public Feedback Link

Residents can submit community feedback without logging in through:

`/feedback`

Example production URL:

`https://commune.soulvest.ai/feedback`
