# Soulvest Commune Backend Deployment

This backend is ready to deploy to Render as a single Node web service.

## Recommended Host

Use Render for the Express API and keep the frontend on GitHub Pages.

Why this path:
- the app is already a standard long-running Express server
- Razorpay requires a server-side secret, so GitHub Pages alone is not enough
- Render supports monorepos cleanly through the root `render.yaml`

## What Was Added

- `render.yaml` at the repo root for one-click Render setup
- `/health` endpoint for Render health checks
- env-driven CORS via `FRONTEND_URL` and `ALLOWED_ORIGINS`
- Firebase Admin auth now supports `FIREBASE_SERVICE_ACCOUNT_JSON`, so you do not need to upload `serviceAccountKey.json`

## Render Setup

1. Push the repository to GitHub.
2. In Render, create a new Blueprint instance from the repository.
3. Confirm it detects the `soulvest-commune-backend` web service from `render.yaml`.
4. Set these required secret env vars in Render before first successful payment use:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

For Razorpay sandbox testing, use your `rzp_test_...` key pair here. You do not need live Razorpay keys for integration testing.

5. Set these if you want the existing chatbot and notification channels live:

- `OPENAI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Firebase Credential Format

Use the full Firebase service account JSON as the value of `FIREBASE_SERVICE_ACCOUNT_JSON`.

Example shape:

```json
{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"..."}
```

Use a single-line JSON string when pasting into Render.

## Frontend Wiring After Backend Deploys

Once Render gives you a backend URL such as:

```text
https://soulvest-commune-backend.onrender.com
```

set the frontend env var:

```text
VITE_API_BASE_URL=https://soulvest-commune-backend.onrender.com
```

Then rebuild and redeploy the frontend so Razorpay requests go to the live API instead of the dev default.

## Health Checks

These endpoints should respond after deploy:

- `GET /health`
- `GET /`

`GET /health` is the Render health check target.

If Firebase credentials are missing, the backend now stays up and reports `firebaseConfigured: false` in the health payload. Routes that require Firestore return `503` with a configuration error instead of crashing the whole service.

## Razorpay Go-Live Checklist

1. Backend deployed and healthy on Render.
2. `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set in Render.
3. `FIREBASE_SERVICE_ACCOUNT_JSON` set in Render.
4. `FRONTEND_URL` and `ALLOWED_ORIGINS` include the exact production frontend origins.
5. Frontend rebuilt with `VITE_API_BASE_URL` pointing to the Render service URL.
6. Test `POST /payments/razorpay/order` from the deployed frontend.

## Razorpay Test Mode

Use Razorpay test keys first.

In Render:

- `RAZORPAY_KEY_ID=rzp_test_...`
- `RAZORPAY_KEY_SECRET=...` for the matching test account

Expected behavior:

- `GET /health` returns `"razorpayMode":"test"`
- `POST /payments/razorpay/order` includes `"mode":"test"` in the response
- the frontend can exercise checkout and verification without switching code paths later

Move to live mode only when you want to accept real payments.

## Manual Render Alternative

If you do not want to use the blueprint file, create a Render Web Service manually with:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`
- Node Version: `20`
- Instance Type: `free`