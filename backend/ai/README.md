# Backend AI Layer

This folder contains the first orchestration layer for Soulvest Commune AI.

Current modules:

- `intent-classifier.js`: request routing into domain-specific agents.
- `mcp-context.js`: request-scoped context builder for resident and society data.
- `agent-orchestrator.js`: task planning and LLM-grounded reply assembly.
- `task-executor.js`: preview-mode and explicit execute-mode handling.
- `task-worker.js`: queue consumer for background tasks stored in `aiTaskQueue`.
- `llm-client.js`: OpenAI chat completion wrapper for concierge responses.

## Task Worker

Run the worker with:

```bash
npm run worker
```

Run a single worker cycle with:

```bash
npm run worker:once
```

The worker currently handles:

- `payment-reminder`
- `delivery-routing-preview`
- `announcement-draft`

Queued tasks are marked as `processing`, then `completed`, `failed`, or `skipped` in Firestore.