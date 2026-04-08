# Soulvest Commune AI Implementation Roadmap

Date: 2026-04-08

This roadmap turns the current AI architecture direction into an execution plan for the existing Soulvest Commune codebase.

## Current Baseline

Already implemented in the repository:

- MCP-style request context assembly in `backend/ai/mcp-context.js`
- Agent gateway entrypoint at `POST /agent-message` via `backend/chatbot-llm.js`
- Intent routing and orchestration in `backend/ai/intent-classifier.js` and `backend/ai/agent-orchestrator.js`
- LLM integration in `backend/ai/llm-client.js`
- Preview-first task planning with confirmed execute mode for visitor approval and complaint creation in `backend/ai/task-executor.js`
- Background task queue consumption in `backend/ai/task-worker.js`
- Resident-facing AI concierge UI in `src/components/ChatbotWidget.jsx`

That means Sprint 1 foundation work is now implemented, Sprint 2 core orchestration work is implemented for the current resident concierge scope, and Phase 3 remains open.

## Phase 1 - Immediate (Weeks 1-4)

Goal: complete the AI foundation and harden the context layer.

### Workstreams

1. MCP Context Store

- Finalize resident context schema: flat ID, role, language, dues status, staff list, visitor state, complaint state, booking state
- Separate request-scoped context from persistent context storage contracts
- Add backend context-fetch adapters instead of relying only on frontend snapshots
- Normalize society-scoped entity lookup across users, visitors, payments, complaints, announcements, and bookings

2. Agent Gateway

- Keep `POST /agent-message` as the single orchestration entrypoint
- Add structured audit logging for routed intents, chosen agents, execution mode, task outcomes, latency, and failures
- Add correlation IDs per request for traceability across gateway, orchestrator, executor, and worker

3. Base LLM Integration

- Keep the existing OpenAI-compatible client abstraction in `backend/ai/llm-client.js`
- Externalize provider details so Azure OpenAI or another compatible endpoint can be swapped in without changing orchestration logic
- Add prompt versioning and fallback behavior for empty or failed LLM responses

4. Frontend AI Concierge

- Keep `src/components/ChatbotWidget.jsx` as the primary entrypoint
- Improve rendering of task previews, execution state, and confirmation requirements
- Surface clearer distinctions between preview, queued, completed, blocked, and failed tasks

### Phase 1 Deliverable

Resident-aware AI concierge with stable context retrieval, structured routing logs, and hardened preview/execute flows.

### Phase 1 Status

- Done: resident MCP context schema, backend context hydration, gateway correlation ids, evaluation logging, Azure/OpenAI-compatible LLM wiring, resident dashboard chat UI, preview and execute task surfacing
- In progress: deeper analytics and longer-lived audit reporting improvements
- Not done: none for the original Sprint 1 deliverable

## Phase 2 - Near-Term (Months 2-3)

Goal: expand specialized agents and support multi-agent automation.

### Workstreams

1. Specialized Agents

- Visitor Agent: QR or OTP issuance, approval, denial, validity windows, visitor anomaly flags
- Delivery Agent: doorstep versus security routing, resident confirmation, guard coordination
- Staff Agent: attendance tracking, expected-arrival checks, exceptions, recurring staff access logic
- Finance Agent: dues status, reminders, Razorpay handoff, payment follow-up summaries
- Complaint Agent: complaint creation, categorization, priority inference, status follow-up

2. Multi-Agent Orchestrator

- Extend `backend/ai/agent-orchestrator.js` to decompose multi-intent requests into ordered subtasks
- Support chained execution for commands such as approving a visitor and scheduling a dues reminder in one turn
- Add agent dependency rules so blocking subtasks fail safely without corrupting the rest of the plan

3. Voice Interface

- Add speech-to-text on the frontend for resident and guard workflows
- Reuse the existing agent gateway after transcription so voice remains only an input layer, not a separate orchestration path

4. AI-Enhanced Notifications

- Build richer summaries on top of `backend/notification-service.js`
- Add support for FCM-first delivery with optional WhatsApp integration when available
- Ensure worker-generated notifications include task metadata and trace IDs

### Phase 2 Deliverable

Multi-agent orchestration that can interpret compound instructions, queue background work, and execute more resident and admin tasks safely.

### Phase 2 Status

- Done: visitor, delivery, staff, finance, and complaint agents; multi-intent orchestration ordering; delivery-to-complaint collaboration handoff; browser speech-to-text input; agent decision trail logging; direct execute-mode delivery routing, payment reminders, and announcement drafts; worker support for payment reminders and announcement drafts
- In progress: broader task-handler coverage and deeper staff-specific automation
- Not done: optional notification-channel expansion beyond the current delivery path

## Validation Snapshot

Validated on 2026-04-08:

- frontend production build completed successfully with existing non-blocking Vite `use client` warnings from MUI and React Router packages
- backend AI modules loaded successfully via Node runtime import check
- `GET /health` responded successfully from the live Express server
- `POST /agent-message` returned a successful multi-agent preview response for a voice-origin delivery-plus-complaint request, including hydrated MCP context, collaboration metadata, and preview tasks
- `npm test` in `backend/` now runs a smoke suite that validates preview flow plus execute-mode delivery routing, finance reminders, and announcement drafting

## Phase 3 - Visionary (Months 4-6)

Goal: add predictive intelligence, community analytics, and resilience.

### Workstreams

1. AI Risk Scoring

- Detect unusual visitor timing, repeated denials, abnormal staff or delivery patterns, and suspicious late-night entry behavior

2. Predictive Maintenance

- Cluster complaint categories and recurrence by building, amenity, time window, and vendor history

3. Resident Sentiment Dashboard

- Aggregate feedback, complaint language, and announcement acknowledgements into community health signals

4. Smart Summaries

- Generate monthly and weekly resident digests covering visitors, deliveries, payments, bookings, and complaints

5. Offline Gate Mode

- Support QR or OTP validation under poor connectivity with delayed sync once the network is restored

### Phase 3 Deliverable

Predictive, analytics-driven community operations with resilient gate workflows and proactive resident insights.

### Phase 3 Status

- Not started in the current codebase

## Technical Stack Alignment

| Layer | Current / Recommended Direction |
|-------|----------------------------------|
| Frontend | React + react-i18next + optional voice SDK |
| Backend | Node.js + Express + Firestore + agent gateway |
| AI Layer | OpenAI-compatible LLM client now, provider-abstracted for Azure OpenAI or similar |
| Orchestration | Custom orchestrator today, expandable toward LangChain or Semantic Kernel if orchestration complexity justifies it |
| Context Protocol | MCP-style JSON context already present in backend modules |
| Integrations | Razorpay live/test endpoints, FCM-ready notification path, optional WhatsApp and IoT gate integration later |

## Recommended Execution Sequence

To keep delivery risk low, the next implementation order should be:

1. Bind execute mode to authenticated server-side identity and authorization checks
2. Add structured AI request and task audit logs
3. Expand worker handlers for more queued actions
4. Add backend-native context fetchers so orchestration is not dependent on frontend snapshots alone
5. Add compound multi-intent execution in the orchestrator
6. Add voice input and richer notification channels
7. Add predictive scoring and analytics surfaces

## Evaluation Loop

Track these metrics continuously:

- response accuracy
- task completion rate
- preview-to-execution conversion rate
- execution failure rate
- user satisfaction by role
- end-to-end latency per agent and worker task type

Use logged AI decisions to compare proposed actions against real user behavior, then refine prompts, routing logic, and context schemas incrementally.

## Expected Outcome

If the roadmap is followed in this order, Soulvest Commune evolves from a context-aware assistant into a full AI-orchestrated community operations platform with safe execution, background automation, and predictive intelligence.