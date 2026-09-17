# AI Gateway Monitoring Design

Date: 2026-07-09

## Goal

Build an admin-only AI Gateway monitoring center for CSCAPilot. The first version should make model usage, token consumption, key health, failures, latency, and estimated CNY cost visible without introducing external monitoring infrastructure.

The page should help answer:

- How many AI calls happened today, this week, or this month?
- Which modules and task types consume the most tokens?
- Which model and key are being used?
- Are failures caused by missing keys, rate limits, timeouts, provider errors, or network errors?
- What is the estimated model cost in USD and CNY?
- Are any keys in cooldown or overloaded?

## Current Project Fit

This design should be implemented as an extension of the current admin AI operations area, not as a totally separate subsystem.

The current project already has:

- Admin AI operations route: `/admin/ai`
- Frontend page: `frontend/src/pages/AdminAIOperationsPage.tsx`
- Route registry entry: `routes.adminAiOperations`
- Admin AI question bank route: `/admin/ai-question-bank`
- Existing adaptive AI admin APIs under:

```text
/api/v1/admin/csca-special-practice/adaptive/ai/*
```

- Existing gateway health endpoint:

```text
GET /api/v1/admin/csca-special-practice/adaptive/ai/gateway-health
```

- Existing AI observability service for older AI Coach / interaction data:

```text
backend/src/csca-special-practice/ai-observability.service.ts
```

- Existing AI Gateway module:

```text
backend/src/ai-gateway/ai-gateway.module.ts
```

Therefore V1 should prefer:

1. Add a new `Gateway` tab/section inside `/admin/ai`.
2. Add reusable Gateway monitoring service under `backend/src/ai-gateway/`.
3. Expose admin endpoints either under the existing adaptive AI admin path for consistency, or under a short global admin path if the monitor is intended to cover all AI modules.

Recommended endpoint namespace for V1:

```text
/api/v1/admin/ai-gateway/*
```

Reason: the new Gateway logs cover AI Coach, question generation, review, topic mapping, and future AI modules. They are broader than `csca-special-practice/adaptive/ai`.

## Scope

### In Scope

- Admin-only backend reporting APIs.
- Admin UI page for AI Gateway monitoring.
- Aggregation from the existing `ai_gateway_call_logs` table.
- CNY display based on a configurable USD/CNY exchange rate.
- Cost estimation from prompt and completion token usage.
- Key-level usage and failure monitoring using masked key IDs only.
- Recent error log inspection.
- Gateway health snapshot.

### Out of Scope For V1

- Prometheus, Grafana, or external APM integration.
- Real-time websocket updates.
- Automatic exchange-rate fetching.
- Billing-grade financial accounting.
- Exposing raw provider API keys.
- Full prompt/content inspection.

## Current Implementation Status

Status as of 2026-07-10:

- Implemented `AiGatewayCostService` under `backend/src/ai-gateway/`.
- `AiGatewayService.writeLedger()` now estimates USD cost before writing `ai_gateway_call_logs.estimated_cost`.
- Implemented admin-only monitor endpoints under `/api/v1/admin/ai-gateway/*`.
- Implemented summary, task, key, error, and health views from `ai_gateway_call_logs`.
- Added Gateway monitor API client functions and frontend response types.
- Added a `网关监控` section inside the existing `/admin/ai` observability surface.
- Added cost and currency environment variables to `.env.example` and `.env.production.example`.
- Added coverage to `scripts/csca-ai-gateway-rules-test.cjs` for cost estimation and missing-token behavior.

Remaining V1 gaps:

- No dedicated historical trend chart yet; the current UI shows current-range totals and grouped tables.
- No CSV export yet.
- Aggregation mapping and cost calculation are covered by `npm run csca-ai-gateway:rules`; database-backed integration coverage can be added later if needed.
- Production `deploy/.env` still needs the new pricing variables added manually.

## Existing Foundation

The project already has an AI Gateway log table:

```text
ai_gateway_call_logs
```

Relevant columns:

```text
request_id
task_type
source_module
provider_id
model
key_id
user_id
organization_id
status
error_code
error_message
latency_ms
prompt_tokens
completion_tokens
total_tokens
estimated_cost
metadata
created_at
```

Useful indexes already exist:

```text
idx_ai_gateway_call_logs_task_created
idx_ai_gateway_call_logs_provider_created
idx_ai_gateway_call_logs_key_created
idx_ai_gateway_call_logs_user_created
idx_ai_gateway_call_logs_org_created
```

The project also has older AI observability based on:

```text
csca_ai_interactions
csca_ai_usage_ledger
```

Those tables power existing AI Coach/entitlement reporting. They should not be removed. The new monitor should sit alongside them:

- Existing observability: user-facing AI Coach usage, rollout quality, feedback, entitlement consumption.
- New Gateway monitor: provider calls, model/key usage, latency, provider failures, token usage, CNY cost.

These are related but not interchangeable.

## Environment Configuration

Add these variables to `.env.example`, `.env.production.example`, and production `deploy/.env` if missing.

```env
AI_GATEWAY_ENABLED=true
AI_GATEWAY_LEDGER_ENABLED=true

DEEPSEEK_API_KEYS=sk-key-1,sk-key-2,sk-key-3
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_DEFAULT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner
DEEPSEEK_KEY_CONCURRENCY=2

AI_GATEWAY_GLOBAL_CONCURRENCY=5
AI_GATEWAY_REALTIME_CONCURRENCY=3
AI_GATEWAY_BACKGROUND_CONCURRENCY=2
AI_GATEWAY_QUEUE_TIMEOUT_MS=5000

AI_GATEWAY_COST_CURRENCY=USD
AI_GATEWAY_DISPLAY_CURRENCY=CNY
AI_GATEWAY_USD_CNY_RATE=7.25

DEEPSEEK_CHAT_INPUT_COST_PER_1M_TOKENS=0.27
DEEPSEEK_CHAT_OUTPUT_COST_PER_1M_TOKENS=1.10
DEEPSEEK_REASONER_INPUT_COST_PER_1M_TOKENS=0.55
DEEPSEEK_REASONER_OUTPUT_COST_PER_1M_TOKENS=2.19
```

Notes:

- `DEEPSEEK_API_KEYS` supports one key or multiple comma-separated keys.
- `AI_GATEWAY_USD_CNY_RATE` is intentionally static in V1. Update it manually when needed.
- Keep provider keys server-side only.
- Never expose `DEEPSEEK_API_KEYS` in frontend code or API responses.

## Cost Calculation

Store provider cost in USD in `ai_gateway_call_logs.estimated_cost`.

Display both USD and CNY in the admin UI:

```text
USD 0.87 / approx. CNY 6.31
```

Formula:

```text
input_cost_usd = prompt_tokens / 1,000,000 * input_price_per_1m
output_cost_usd = completion_tokens / 1,000,000 * output_price_per_1m
estimated_cost_usd = input_cost_usd + output_cost_usd
estimated_cost_cny = estimated_cost_usd * AI_GATEWAY_USD_CNY_RATE
```

Model price selection:

- If model contains `reasoner`, use `DEEPSEEK_REASONER_*`.
- Otherwise use `DEEPSEEK_CHAT_*`.

When token usage is missing:

- Keep `estimated_cost` as `null`.
- UI displays `--`.
- Do not guess token usage from character count in V1.

## Backend Implementation

### Files

Suggested files:

```text
backend/src/ai-gateway/ai-gateway-cost.service.ts
backend/src/ai-gateway/ai-gateway-monitor.service.ts
backend/src/ai-gateway/ai-gateway-monitor.controller.ts
```

Rationale:

- The project already has `backend/src/ai-gateway/`.
- `AiGatewayModule` already imports `PrismaModule`.
- Keeping monitor logic inside the gateway module avoids scattering provider-specific reporting into the adaptive practice controller.

Update:

```text
backend/src/ai-gateway/ai-gateway.module.ts
```

to provide:

```text
AiGatewayCostService
AiGatewayMonitorService
AiGatewayMonitorController
```

The controller must protect every endpoint with `RequiredAdminGuard`.

### Cost Service

Responsibilities:

- Read model prices from env.
- Read USD/CNY exchange rate from env.
- Estimate USD cost from prompt/completion token counts.
- Return display metadata for API responses.

Interface:

```ts
type AiGatewayCostInput = {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

type AiGatewayCostEstimate = {
  estimatedCostUsd: number | null;
  estimatedCostCny: number | null;
  currency: 'USD';
  displayCurrency: 'CNY';
  usdCnyRate: number;
};
```

### Ledger Write Path

Update `AiGatewayService.writeLedger()` or `AiGatewayLedgerService.record()` so `estimatedCost` is populated before writing `ai_gateway_call_logs`.

Expected write behavior:

```text
success with token usage -> estimated_cost populated
success without token usage -> estimated_cost null
failure -> estimated_cost null
```

Current gap:

- `AiGatewayLedgerService.record()` already accepts `estimatedCost`.
- `AiGatewayService.writeLedger()` currently passes provider/model/token data but does not calculate `estimatedCost`.
- Add `AiGatewayCostService` to the Gateway module and use it before ledger write.

Preferred integration:

```text
AiGatewayService.writeLedger()
  -> AiGatewayCostService.estimate(...)
  -> AiGatewayLedgerService.record({ estimatedCost })
```

### Admin APIs

All endpoints must require admin access.

```http
GET /api/v1/admin/ai-gateway/summary?from=&to=
GET /api/v1/admin/ai-gateway/by-task?from=&to=
GET /api/v1/admin/ai-gateway/by-key?from=&to=
GET /api/v1/admin/ai-gateway/errors?from=&to=&limit=50
GET /api/v1/admin/ai-gateway/health
```

Current related endpoint already exists:

```text
GET /api/v1/admin/csca-special-practice/adaptive/ai/gateway-health
```

Recommended compatibility behavior:

- Keep the existing endpoint so the current AI operations page does not break.
- Add `GET /api/v1/admin/ai-gateway/health` for the new global monitor.
- Both may call the same `aiGatewayService.health()`.

Use ISO timestamps for `from` and `to`. If not provided:

- `from`: start of current day
- `to`: now

Clamp custom ranges:

- Maximum default UI query range: 90 days
- Maximum `errors.limit`: 200

### Summary Response

```json
{
  "range": {
    "from": "2026-07-09T00:00:00.000Z",
    "to": "2026-07-09T23:59:59.999Z"
  },
  "summary": {
    "calls": 120,
    "successCalls": 108,
    "failedCalls": 12,
    "successRate": 0.9,
    "totalTokens": 456000,
    "promptTokens": 300000,
    "completionTokens": 156000,
    "averageLatencyMs": 4300,
    "estimatedCostUsd": 0.87,
    "estimatedCostCny": 6.31,
    "currency": "USD",
    "displayCurrency": "CNY",
    "usdCnyRate": 7.25
  }
}
```

### Task Aggregation Response

Group by:

```text
task_type
source_module
provider_id
model
```

Response row:

```json
{
  "taskType": "question_generation",
  "sourceModule": "ai-questioning",
  "providerId": "deepseek",
  "model": "deepseek-chat",
  "calls": 80,
  "successCalls": 74,
  "failedCalls": 6,
  "successRate": 0.925,
  "totalTokens": 320000,
  "promptTokens": 210000,
  "completionTokens": 110000,
  "averageLatencyMs": 5200,
  "estimatedCostUsd": 0.61,
  "estimatedCostCny": 4.42
}
```

### Key Aggregation Response

Group by:

```text
provider_id
key_id
```

Response row:

```json
{
  "providerId": "deepseek",
  "keyId": "deepseek:key-1",
  "calls": 35,
  "successCalls": 30,
  "failedCalls": 5,
  "successRate": 0.857,
  "totalTokens": 120000,
  "averageLatencyMs": 4800,
  "latestErrorCode": "provider_rate_limited",
  "latestErrorAt": "2026-07-09T08:20:00.000Z",
  "lastCalledAt": "2026-07-09T08:30:00.000Z"
}
```

### Error Response

Return recent non-success rows:

```json
{
  "items": [
    {
      "createdAt": "2026-07-09T08:31:00.000Z",
      "taskType": "question_generation",
      "sourceModule": "ai-questioning",
      "providerId": "deepseek",
      "model": "deepseek-chat",
      "keyId": "deepseek:key-1",
      "status": "provider_unavailable",
      "errorCode": "gateway_no_key_available",
      "errorMessage": "No AI provider key is available.",
      "latencyMs": 0
    }
  ]
}
```

### Health Response

Use existing `aiGatewayService.health()` and expose it through the admin endpoint.

Include:

- Gateway status.
- Provider status.
- Key cooldown status.
- Queue/concurrency snapshot.

Do not include raw key values.

## SQL Reference

Manual production checks:

```sql
select provider_id, model, status, count(*) as calls, sum(total_tokens) as tokens
from ai_gateway_call_logs
group by provider_id, model, status
order by calls desc;
```

```sql
select key_id, status, count(*) as calls, sum(total_tokens) as tokens, avg(latency_ms)::int as avg_ms
from ai_gateway_call_logs
group by key_id, status
order by calls desc;
```

```sql
select created_at, task_type, model, key_id, status, error_code, error_message
from ai_gateway_call_logs
where status <> 'success'
order by created_at desc
limit 30;
```

## Frontend Implementation

### Route

Do not create a standalone route by default. The project already has:

```text
/admin/ai
```

Recommended V1:

```text
Add a Gateway Monitor section inside the existing Observability tab on /admin/ai
```

Only add a dedicated route later if `/admin/ai` becomes too crowded:

```text
/admin/ai-gateway
```

If a dedicated route is added, update:

```text
frontend/src/lib/routes.ts
```

with:

```text
adminAiGateway: '/admin/ai-gateway'
```

### Page Structure

Preferred file for V1:

```text
frontend/src/pages/AdminAIOperationsPage.tsx
```

Add a section inside the existing observability surface named:

```text
网关监控
```

If the component gets large, extract:

```text
frontend/src/components/admin/ai-operations/AiGatewayMonitorPanel.tsx
```

Layout:

1. Header
   - Title: `AI 监控`
   - Subtitle: `查看模型调用、Token 消耗、Key 状态和失败原因。`
   - Range selector: today, 7 days, 30 days, custom.

2. Summary cards
   - Calls
   - Success rate
   - Total tokens
   - Average latency
   - Failed calls
   - Estimated cost in CNY

3. Gateway health panel
   - Status badge.
   - Queue usage.
   - Key cooldown warnings.

4. Task table
   - Task type
   - Module
   - Model
   - Calls
   - Success rate
   - Tokens
   - Avg latency
   - Estimated CNY cost

5. Key table
   - Key ID
   - Calls
   - Success rate
   - Tokens
   - Avg latency
   - Latest error
   - Last called at

6. Recent failures
   - Time
   - Task
   - Model
   - Key
   - Status
   - Error code
   - Error message

### UI States

Empty state:

```text
还没有 AI 调用记录。
```

No key warning:

```text
当前没有可用 DeepSeek key，请检查 DEEPSEEK_API_KEYS。
```

High failure rate warning:

```text
最近失败率偏高，建议检查 key 限流、余额或网络状态。
```

Cost display:

```text
¥6.31
USD 0.87 · 汇率 7.25
```

### Design Notes

- Keep the page operational and dense.
- Use tables, compact cards, badges, and filters.
- Do not create a marketing-style page.
- Avoid exposing raw keys.
- Use muted colors for normal metrics, red/amber for failure states.
- Match existing `AdminAIOperationsPage` spacing, card, badge, and table styles.
- Avoid creating a second admin AI landing page unless navigation becomes overloaded.

## Permissions

Only admins can access these APIs and the frontend page.

Backend:

```ts
@UseGuards(RequiredAdminGuard)
```

Frontend:

- Reuse existing admin route protection patterns.
- If this is embedded in `/admin/ai`, no separate navigation permission is needed.
- If a dedicated route is added later, hide it from non-admin users and show forbidden/redirect if opened directly.

## Deployment Steps

After implementation:

```bash
cd /www/wwwroot/cscalite
git fetch origin
git checkout codex/deepseek-ai-gateway
git pull origin codex/deepseek-ai-gateway
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml run --rm migrate
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --build
```

Verify health:

```bash
curl http://127.0.0.1:18080/api/v1/health
```

Verify logs table:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml exec db psql -U postgres -d cscalite -c "
select count(*) from ai_gateway_call_logs;
"
```

## Acceptance Criteria

Backend:

- Admin summary endpoint returns calls, success rate, tokens, latency, USD cost, and CNY cost.
- Task aggregation endpoint groups correctly by task/module/provider/model.
- Key aggregation endpoint groups by masked key ID and never returns raw keys.
- Error endpoint returns recent failed calls.
- Health endpoint returns gateway/key/queue status.
- Cost calculation returns null when token usage is missing.
- Existing adaptive AI `gateway-health` endpoint continues to work.
- Existing AI Coach observability endpoints continue to work.

Frontend:

- Admin can open `/admin/ai`.
- Admin can switch to the Gateway Monitor section/tab.
- Page shows summary cards.
- Page shows task usage table.
- Page shows key usage table.
- Page shows recent failures.
- CNY cost is visible by default, with USD shown as secondary detail.
- Empty states and no-key warnings are clear.

Security:

- Raw provider API keys never appear in frontend responses.
- Non-admin users cannot access monitoring APIs.
- Error messages are shown, but request prompts and model outputs are not displayed in V1.

Operational:

- Production can identify `gateway_no_key_available`, `provider_rate_limited`, and `provider_timeout` quickly.
- Production can estimate daily and monthly AI cost in CNY.
- Production can identify overloaded or failing keys.

## Implementation Priority For This Codebase

Recommended order based on the current project structure:

1. Add `AiGatewayCostService`.
2. Update `AiGatewayService.writeLedger()` to populate `estimatedCost`.
3. Add `AiGatewayMonitorService` with summary/task/key/error aggregation.
4. Add `AiGatewayMonitorController` under `backend/src/ai-gateway/`.
5. Register monitor service/controller in `AiGatewayModule`.
6. Add API client functions to `frontend/src/lib/api-admin.ts`.
7. Add a `网关监控` section to the existing Observability tab in `frontend/src/pages/AdminAIOperationsPage.tsx`.
8. Keep the existing `/api/v1/admin/csca-special-practice/adaptive/ai/gateway-health` endpoint for compatibility.
9. Add focused tests for cost calculation and aggregation.

## Future Enhancements

- Export CSV.
- Daily/monthly cost trend chart.
- Per-user and per-organization usage drilldown.
- Alert thresholds for high failure rate or cost spikes.
- Automatic provider price versioning.
- Grafana/Prometheus integration once traffic grows.
