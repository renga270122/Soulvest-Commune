# Soulvest Commune Change Summary

This document captures the implementation work completed after the previous deployment-hardening pass, with emphasis on release stabilization, Bangalore-focused language scope, and the first AI concierge orchestration layer.

## 1. Language Scope Narrowed To English And Kannada

The app was narrowed to the currently supported launch scope for Bangalore deployments.

Implemented changes:

- Removed the unused Tamil language path from [src/i18n/index.js](src/i18n/index.js).
- Added a shared supported-language registry in [src/i18n/index.js](src/i18n/index.js) so UI language pickers use one source of truth.
- Updated profile, signup, login, and announcement flows to use the shared supported-language list instead of hardcoded language options.
- Removed the unused Hindi locale file from the repo during release cleanup.

Outcome:

- The app now consistently exposes English and Kannada only, matching the current Bangalore rollout target.

## 2. Auth Context And Frontend Wiring Cleanup

The auth context usage was normalized across the app to avoid mixed imports and to support language preference syncing.

Implemented changes:

- Added [src/components/auth-context.js](src/components/auth-context.js) as the shared context definition and hook export.
- Updated the app to import `useAuthContext` from the shared auth-context module instead of duplicating context access patterns.
- Updated [src/components/AuthContext.jsx](src/components/AuthContext.jsx) so active user language now syncs into i18n automatically.

Outcome:

- Context usage is now consistent across the app, and a user language preference change updates the active translation state reliably.

## 3. Resident Experience Localization Expansion

The complaints, expenses, and facility booking flows were expanded with translation-backed copy instead of inline strings.

Implemented changes:

- Added structured translation keys for complaints, expenses, bookings, and common actions in [src/i18n/en.json](src/i18n/en.json) and [src/i18n/kn.json](src/i18n/kn.json).
- Updated [src/pages/Complaints.jsx](src/pages/Complaints.jsx) to use translated labels, status text, dialog copy, and filter text.
- Updated [src/pages/Expenses.jsx](src/pages/Expenses.jsx) to use translated payment, reminder, receipt, and Razorpay copy.
- Updated [src/pages/FacilityBookings.jsx](src/pages/FacilityBookings.jsx) to use translated amenity labels, booking copy, and validation messages.

Outcome:

- Core resident workflows now share a cleaner localization structure and are easier to maintain as the app grows.

## 4. Backend Firebase Fault-Tolerance

The backend was hardened so missing Firebase credentials no longer take down the service.

Implemented changes:

- Refactored [backend/firebase.js](backend/firebase.js) to expose `getDb()` and `getFirebaseStatus()` instead of exporting an always-initialized Firestore instance.
- Added lazy initialization, service-account normalization, and explicit status reporting in [backend/firebase.js](backend/firebase.js).
- Updated [backend/index.js](backend/index.js) so Firebase-backed routes return `503` when credentials are missing instead of crashing the backend process.
- Updated health responses in [backend/index.js](backend/index.js) to include `firebaseConfigured` and `firebaseMessage`.
- Documented this behavior in [README.md](README.md) and [backend/README.md](backend/README.md).

Outcome:

- The backend now remains deployable even when Firebase credentials are absent, while still failing clearly for routes that actually require Firestore.

## 5. AI Concierge Agent Gateway

The chatbot architecture was extended from a stateless LLM endpoint into a routed agent gateway with MCP-style context packing.

Implemented changes:

- Added [backend/ai/intent-classifier.js](backend/ai/intent-classifier.js) for domain routing across visitor, delivery, finance, complaint, staff, announcement, booking, and concierge intents.
- Added [backend/ai/mcp-context.js](backend/ai/mcp-context.js) to build a normalized context object from resident, society, and live entity snapshots.
- Added [backend/ai/agent-orchestrator.js](backend/ai/agent-orchestrator.js) to build agent plans, summarize routed work, and coordinate task execution.
- Added [backend/ai/task-executor.js](backend/ai/task-executor.js) to support preview-first task handling and Firestore queue writes to `aiTaskQueue` in execute mode.
- Added [backend/ai/llm-client.js](backend/ai/llm-client.js) to ground LLM responses using MCP context and agent summaries.
- Updated [backend/chatbot-llm.js](backend/chatbot-llm.js) to expose `POST /agent-message` while retaining the legacy `POST /chatbot-llm` endpoint.

Outcome:

- The backend now has a practical first-pass AI orchestration layer that can classify resident requests, ground them in current app context, and return structured plans safely.

## 6. Frontend AI Concierge Integration

The resident chatbot widget now sends structured context to the backend agent gateway instead of relying only on local rules or a raw LLM fallback.

Implemented changes:

- Added [src/services/aiConcierge.js](src/services/aiConcierge.js) as the frontend transport helper for `POST /agent-message`.
- Updated [src/components/ChatbotWidget.jsx](src/components/ChatbotWidget.jsx) to:
  - collect payments, complaints, bookings, staff attendance, visitors, and announcements into a context snapshot
  - send recent chat history and current resident identity to the backend gateway
  - use preview mode by default for safe plan generation
  - display routed agent chips and task preview lines in chat responses
- Expanded local concierge handling to cover visitor and announcement questions when backend AI is unavailable.

Outcome:

- Chat responses are now resident-aware and structured, with visible agent/task metadata for follow-up work.

## 7. Confirmed Execute-Mode Actions

The first AI actions that can move beyond preview mode are now wired behind explicit confirmation.

Implemented changes:

- Updated [backend/ai/agent-orchestrator.js](backend/ai/agent-orchestrator.js) so visitor approval and complaint creation tasks now produce stable task ids and confirmation-required metadata.
- Updated [backend/ai/task-executor.js](backend/ai/task-executor.js) so:
  - execute mode requires explicit `approvedTaskIds`
  - visitor approval runs directly against Firestore when Firebase is configured
  - complaint creation writes directly into the society complaints collection when Firebase is configured
  - unsupported execute-mode tasks still fall back to queueing in `aiTaskQueue`
- Updated [backend/chatbot-llm.js](backend/chatbot-llm.js) so `POST /agent-message` accepts confirmation payloads for execute-mode calls.
- Updated [src/components/ChatbotWidget.jsx](src/components/ChatbotWidget.jsx) so previewed tasks with confirmation requirements render a `Run Plan` button inside the chat UI.

Outcome:

- The AI concierge can now safely move two high-value actions from plan generation into confirmed execution, while still defaulting all requests to preview mode.
- Execution remains guarded by explicit confirmation and role checks, and it degrades back to preview when Firebase is unavailable.

## 8. AI Task Worker

The task orchestration layer now has a queue consumer so non-immediate AI work can be processed in the background.

Implemented changes:

- Added [backend/ai/task-worker.js](backend/ai/task-worker.js) as a standalone worker process for `aiTaskQueue`.
- Added [backend/ai/README.md](backend/ai/README.md) to document the backend AI layer and worker commands.
- Added backend scripts in [backend/package.json](backend/package.json) for `npm run worker` and `npm run worker:once`.
- Updated [backend/README.md](backend/README.md) with deployment guidance for running the worker as a separate background process.

Current worker handlers:

- payment reminders using the existing notification service
- delivery routing tasks that update visitor delivery state and notify the relevant resident or guard
- announcement draft creation for queued admin-facing drafts

Outcome:

- The architecture now includes the first real background task-consumer layer for queued AI work, which is the missing bridge between plan generation and deferred execution.

## 9. Validation And Release Readiness

The implementation was revalidated to ensure the recent changes remain production-build compatible.

Validation completed:

- `npm run lint` completed successfully.
- Backend route loading for [backend/chatbot-llm.js](backend/chatbot-llm.js) completed successfully.
- `npm run build` completed successfully.
- Existing Vite and MUI `use client` warnings remained non-blocking and did not fail the build.

Outcome:

- The current frontend and backend code paths are in a releasable state for the present scope.

## 10. Current Constraints And Next Work

The new AI layer is intentionally safe and partial rather than fully autonomous.

Current constraints:

- Frontend AI actions are preview-only by default.
- Execute mode is only implemented for visitor approval and complaint creation; other task types still queue to Firestore when supported.
- The worker currently handles reminders, delivery routing, and announcement drafts, but not every future agent task type yet.
- Sensitive actions are not yet protected by an execution approval flow.
- The frontend remains demo-first, so backend execution and resident-visible state are not fully reconciled yet.

Recommended next steps:

- add authenticated execution for a small set of high-value actions such as visitor approval and complaint creation
- add an `aiTaskQueue` worker to convert queued plans into real notifications or mutations
- add explicit user confirmation UI for actionable AI plans
