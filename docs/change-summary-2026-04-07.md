# Soulvest Commune Change Summary

This document summarizes the main changes completed in the current implementation pass.

## 1. Demo-Only Frontend Mode

The frontend was shifted away from runtime Firebase dependence for the main user flows and now runs as a browser-local demo environment.

Implemented changes:

- Added [src/services/demoStore.js](src/services/demoStore.js) as the localStorage-backed source of truth for demo users, visitors, payments, announcements, complaints, bookings, attendance, and notifications.
- Added [src/services/demoData.js](src/services/demoData.js) to expose the same app-facing data functions previously served by Firestore-backed code.
- Added [src/services/demoAuth.js](src/services/demoAuth.js) for demo login, quick access, password reset messaging, resident signup, and full demo reset.
- Simplified [src/services/communityData.js](src/services/communityData.js) to re-export the demo data implementation.
- Simplified [src/config/firestore.js](src/config/firestore.js) so it no longer imports Firebase runtime objects in the demo path.
- Added [src/config/appMode.js](src/config/appMode.js) as a lightweight app mode marker.

Outcome:

- The app can be demonstrated without needing live Firebase authentication or live Firestore reads for core frontend flows.

## 2. Demo Authentication and UX

Login and onboarding were updated to match the new demo-mode model.

Implemented changes:

- Updated [src/pages/LoginPage.jsx](src/pages/LoginPage.jsx) to use browser-local demo accounts.
- Added visible demo credentials and one-click role-based quick access.
- Replaced Firebase password reset behavior with demo guidance.
- Updated [src/pages/SignupPage.jsx](src/pages/SignupPage.jsx) so resident signup creates a browser-local demo resident and immediately starts a session.
- Updated [src/pages/Home.jsx](src/pages/Home.jsx) to use session user data and expose a clean demo logout action.

Outcome:

- The app now supports a self-contained walkthrough for resident, guard, and admin roles directly in the browser.

## 3. Admin Demo Reset Control

The admin experience now includes a reset action for restoring the demo state.

Implemented changes:

- Updated [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx) with a `Demo Controls` section.
- Added a reset action that clears browser-local activity and reseeds demo residents, visitors, payments, and announcements.

Outcome:

- A demo can be reset without clearing browser storage manually.

## 4. Razorpay Payment Integration

The resident expenses flow was moved from a local-only payment confirmation model to a real server-backed Razorpay pattern.

Implemented changes:

- Added [src/services/razorpay.js](src/services/razorpay.js) to load Razorpay Checkout, create backend orders, and verify completed payments.
- Updated [src/pages/Expenses.jsx](src/pages/Expenses.jsx) to:
  - default to Razorpay Checkout
  - create a backend order before opening checkout
  - verify the gateway response on the backend
  - mark a payment as paid only after successful verification
  - display gateway order details in the receipt modal
- Updated [backend/index.js](backend/index.js) with:
  - `POST /payments/razorpay/order`
  - `POST /payments/razorpay/verify`
  - HMAC-based signature verification
  - payment verification logging to Firestore
- Added the Razorpay dependency to [backend/package.json](backend/package.json) and [backend/package-lock.json](backend/package-lock.json).

Outcome:

- The app now follows the correct payment pattern for Razorpay, with order creation and signature verification on the backend.

Important deployment note:

- The static frontend host is not an API host. Production payments require `VITE_API_BASE_URL` to point at a separately deployed backend.

## 5. Backend Deployment Hardening

The Express backend was made host-ready for deployment on Render.

Implemented changes:

- Updated [backend/firebase.js](backend/firebase.js) to support `FIREBASE_SERVICE_ACCOUNT_JSON` in addition to `GOOGLE_APPLICATION_CREDENTIALS`.
- Updated [backend/index.js](backend/index.js) to add:
  - `GET /health`
  - JSON root health output
  - env-driven CORS via `FRONTEND_URL` and `ALLOWED_ORIGINS`
- Expanded [backend/.env.example](backend/.env.example) with deployment and integration env vars.
- Added Node engine metadata in [backend/package.json](backend/package.json).
- Added Render blueprint config in [render.yaml](render.yaml).
- Added backend deployment instructions in [backend/README.md](backend/README.md).

Outcome:

- The backend now has a concrete deployment path suitable for Razorpay production use.

## 6. Frontend Deployment Updates

Implemented changes:

- Added [.env.example](.env.example) to document frontend API base URL configuration.
- Updated the Razorpay frontend helper so local dev still defaults to `http://localhost:4000`, while production requires an explicit `VITE_API_BASE_URL`.
- Built and published the frontend to GitHub Pages during this implementation pass.

Outcome:

- The current frontend is deployed, and production payment behavior now fails clearly when backend configuration is missing instead of silently targeting the wrong host.

## 7. PostgreSQL Migration Planning Artifacts

Two planning documents were added for the future backend/data migration path.

Added files:

- [docs/postgresql-init.sql](docs/postgresql-init.sql)
- [docs/firebase-to-postgres-mapping.md](docs/firebase-to-postgres-mapping.md)

Outcome:

- The codebase now contains an initial relational schema and a field-level mapping from the current Firestore shape to PostgreSQL targets.

## Validation Performed

Validation completed during this work included:

- frontend production builds with Vite
- backend syntax checks with `node --check`
- targeted error inspection for changed frontend and backend files
- successful GitHub Pages frontend publish

## Remaining Operational Work

The following are still operational tasks rather than code gaps:

- deploy the Express backend to Render
- set `FIREBASE_SERVICE_ACCOUNT_JSON` in the hosted backend
- set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the hosted backend
- set frontend `VITE_API_BASE_URL` to the deployed backend URL and redeploy the frontend
- run one live or sandbox Razorpay payment test after backend deployment

## 8. Public Feedback Collection Form

To support lightweight resident outreach in WhatsApp groups, a public feedback flow was added.

Implemented changes:

- Added [src/pages/FeedbackForm.jsx](src/pages/FeedbackForm.jsx) as a public page that does not require sign-in.
- Added [src/services/feedback.js](src/services/feedback.js) to submit feedback to the backend API.
- Updated [src/routes/AppRoutes.jsx](src/routes/AppRoutes.jsx) to expose the public `/feedback` route.
- Added `POST /feedback` in [backend/index.js](backend/index.js) to store responses in Firestore under `residentFeedback`.

Outcome:

- You can now share a simple public URL such as `https://commune.soulvest.ai/feedback` in a residents WhatsApp group and collect feedback centrally.
- The form can be submitted without collecting name or flat number.