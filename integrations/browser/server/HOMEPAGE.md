# Homepage answer API

This additive release keeps `/api/session`, `/api/analyze`, `/health`, all existing environment configuration and the existing SQLite allowance. It adds ordinary question answering with the complete instructions in `extension/instructions.js`. It does not use the analysis JSON schema. The instruction text is sent to the selected model; this does not establish that every generated answer follows it.

## Explicit test candidate (not a new stable release)

The default remains the complete 1.3.5 extension instruction described above. For a separate test process, `BEFOREWORD_ANSWER_PROFILE=candidate-1.3.6` selects the complete 1.3.6 core plus a product-default supplement. Unknown values fail startup; the client cannot select this value. Candidate answers and capabilities expose `instructionProfile` metadata, not a compliance claim. Exact returned text is never filtered.

[Mapping of all six proposal items, mechanical checks, review limits and rollback](../../../evaluations/answer-pilot/README.md). The candidate artifacts must be deployed explicitly; a repository change is not a live-site update. Existing model selection, secrets, quota policy and durable no-full-text-storage behavior remain unchanged. A repeated UUID under a different profile conflicts rather than triggering another call.

## Shared answers

`POST /api/answer`, allowed `Origin`, `Content-Type: application/json`, and the same `Authorization: Bearer <session>` as `/api/analyze`.

```json
{"text":"Почему 2 + 2 = 4?","language":"ru","trialVersion":2,"requestId":"0b457123-2899-40f6-bf47-c4b21fe0d1f7","history":[]}
```

`text` is preserved exactly, up to 12,000 UTF-16 units. `language` is `ru` or `en`. `requestId` must be a UUIDv4. Optional `history` contains up to four complete user/assistant pairs (eight messages), each `{ "role": "user" | "assistant", "content": "..." }`, starting with user and ending with assistant. The total of current text and history is at most 24,000 UTF-16 units. History is neither silently shortened nor saved in SQLite. The existing 64 KiB body limit also applies.

Success is `{ "answer": "...", "model": "configured model", "trial": { "limit": 8, "remaining": 7 } }`. The answer is nonblank text up to 48,000 UTF-16 units. Render it as untrusted text; never insert generated HTML. The model is the existing `BEFOREWORD_MODEL` setting. The server uses the existing operator key, `store:false`, `reasoning_effort:medium` and an 8,192-token completion cap. No tools, browsing or external account actions are available to this model request.

The same installation ledger covers successful answers and existing analyses. Eight is a total allowance for that installation, not a daily reset. Existing usage is not reset. A new answer commits one slot only after a complete bounded text response; failures and cancellation before completion release its slot. Protective attempt quotas still count admitted provider requests. A complete answer may have committed just before a network disconnect prevents its delivery; retry recovery is described below.

## Personal provider key

`POST /api/answer/personal`, same origin/content type. It requires **no shared session** and is usable after shared allowance exhaustion. Exact body:

```json
{"text":"Why does 2 + 2 = 4?","language":"en","requestId":"40f737c5-279a-4dfb-a580-4d4be3966147","history":[],"provider":"openai","model":"chosen-model-id","apiKey":"user-supplied-key"}
```

Only `openai` and `openrouter` are supported. The server selects the fixed HTTPS URL; it accepts no endpoint, redirect, organization, workspace or arbitrary URL. Model IDs are 1–200 characters from `[A-Za-z0-9._:/-]` and start with an ASCII letter or digit. API keys are 8–512 printable ASCII characters without whitespace.

Success is `{ "answer": "...", "model": "chosen-model-id", "provider": "openai", "trial": null }`. OpenAI uses `max_completion_tokens:8192` and `store:false`; OpenRouter uses `max_tokens:8192`. Personal model reasoning settings and output schemas are not forced. The selected model must support a text chat-completions request; not every listed model or account is compatible.

The key and conversation pass through the beforeword server to the chosen provider over its fixed HTTPS endpoint. The application does not log or persist the raw key, prompt, history or answer. The client should retain its key only in tab memory and disclose this transmission before saving/using it. Usage is charged to the user's provider API budget; a consumer chat subscription is not assumed to pay API usage. Hosting/proxy logging is separate and must exclude request bodies/Authorization headers. Provider retention is governed by that provider; `store:false` does not make a general no-retention claim.

Own-key requests have independent ingress caps (30 per network/hour, 100 per network/day, 1,000 globally/day) and share the existing two-request concurrency cap. They do not use shared trial slots or the operator's provider key.

## Repeat requests and cancellation

Never automatically retry a model call with a new UUID. Use the same UUID and identical payload when recovering a network-uncertain attempt. An explicit new question, or explicit new attempt after a known failure, receives a new UUID.

SQLite stores HMAC request identity, HMAC payload fingerprint, bounded state/error code, lease ID and expiration. The HMAC key is the unchanged private network salt. A personal owner's identity is also an HMAC of origin/provider/key, not a raw key. No prompt, history, answer, UUID or credential is saved in the journal. Entries persist seven days, with at most 20,000 rows; expired rows are lazily removed. No duplicate provider call is submitted for an existing matching request during this interval, including across workers and ordinary restart.

Successful answers are available for replay only in their worker's memory for 15 minutes, with at most 64 entries. A replay returns the latest trial balance. Another worker, cache expiry or restart returns `409 REQUEST_ALREADY_COMPLETED` and the current balance, without another paid call or another trial charge. This is a deliberate recovery limit: the server cannot reproduce a lost answer whose memory cache is gone. Durable answer storage is not introduced by this release.

- `409 REQUEST_IN_PROGRESS`: matching call still holds a lease; `Retry-After: 2`; do not create a new UUID automatically.
- `409 REQUEST_ALREADY_COMPLETED`: completed result no longer available in this worker; shared response includes current `trial`.
- `409 REQUEST_INTERRUPTED`: a crashed/expired lease left an uncertain result; no automatic resubmission.
- `409 REQUEST_ID_CONFLICT`: same owner/UUID but different text, history, language, provider or model.
- Known failed request replays the original bounded error, without calling the provider again.

Disconnect/stop and the 90-second deadline abort the upstream request. Cancellation does not establish that the provider has stopped billing; it prevents the server from making another call automatically. A failure before admission (invalid input, no session, resource cap) has no journal entry and no provider call. Old `/api/analyze` keeps its existing behavior and does not acquire these new UUID semantics.

Additional input codes: `INVALID_HISTORY`, `CONVERSATION_TOO_LONG`, `INVALID_MODEL`, `INVALID_API_KEY`, `UNSUPPORTED_PROVIDER`. `PROVIDER_AUTH` is an own-key upstream authentication error, HTTP 502, not a shared-session 401. All failures keep the bounded `{ "error": { "code": "..." }, "trial"?: {...} }` shape. No provider error text or credentials are returned.

## Deploy safely

1. Preserve the existing private database, salt, operator key, model and origin settings. Do not reset allowance or create a replacement database. Take the usual consistent private SQLite backup before deploying; never put it in the web root or release archive.
2. Include all `server/*.cjs`, specifically the new `server/answer.cjs`, and unchanged shared extension instructions/core. The application package version is 0.3.0. No npm dependencies are introduced.
3. Opening the database adds only `answer_requests` and its index. Existing tables and schema version 3 remain intact; established v1/v2 migrations retain their existing behavior. Run the local `server/check-config.cjs` on the server, then restart through the existing host process manager.
4. Before publishing the new page, request `GET /api/capabilities` from its allowed origin. Expected body: `{ "answer": true, "personalProviders": ["openai","openrouter"], "historyMessages": 8, "conversationChars": 24000, "trialLimit": 8, "idempotencyHours": 168 }`. `/health` remains exactly `{ "ready": true | false }` for existing clients. Capabilities indicates the installed implementation, not a successful paid provider test.
5. Publish the new frontend only after the API route is available. Do not silently fall back to `/api/analyze` as a substitute for answering the user's question. No environment secrets or database files belong in the public page.

Local checks: `node --test tools/test-home-answer.cjs` (12 cases), and `node --test tools/test-analysis-server.cjs` (39 existing cases), all passed with fixture keys and local mocks on Node 24.19.0. The new cases cover exact request/history, no forced schema, replay, exhaustion, failures, deadline/disconnect, multi-worker/restart, own-key routing/isolation, absent raw secrets/content in SQLite, validation and output completion. No live provider request, provider entitlement, deployment, TLS/proxy behavior or generated-answer quality is established by these checks.
