# Ascend Foods — AI Replenishment Demo (`/demo`)

Password-gated demo embedded in this Next.js app, served at **ascendfoods.in/demo**. It mirrors the
real n8n workflow we are building: **the frontend is only the UI; n8n does the work.**

## What this demonstrates (current scope)

A retailer's delivered-order history is analysed and a replenishment basket is recommended for a
human to approve. The journey **stops at human approval** — nothing is sent.

```
Frontend → Next.js proxy → n8n webhook → (fixture today / Google Sheets next)
  → Order Parser → Calculate Reorder Signals → Reorder Decision Agent (the ONE AI agent)
  → Validate Reorder Basket → Validate Final Recommendation → Human Approval (frontend)
```

There is exactly **one AI agent** (`Reorder Decision Agent`). Everything else is deterministic
code / Google Sheets / human approval.

## Two independent concepts

- **Orchestrator** — where the analysis ran: `n8n` (N8N LIVE) or `local_simulation` (LOCAL SIMULATION).
- **Data source** — where the data came from: `google_sheets` (GOOGLE SHEETS) or `fixture` (FIXTURE DATA).

These are separate. n8n currently runs with a temporary fixture loader, so Live mode shows
`N8N LIVE` + `FIXTURE DATA`. Once the Google Sheets nodes are connected it becomes `N8N LIVE` +
`GOOGLE SHEETS`. The badges always come from the response — never assumed from the mode toggle.

## Modes

- **Simulation** (default): runs fully in the browser on fixture data. Shows `LOCAL SIMULATION` +
  `FIXTURE DATA`. Never calls n8n, OpenAI, or Sheets; never claims a message was sent.
- **Live**: calls `POST /demo/api/agent/analyse` → n8n. Renders exactly what n8n returns. On failure
  it shows an explicit error + **Retry** — it never silently falls back to simulation.

## Files

```
app/demo/
  _lib/            client (sim local / live proxy), simulation, reorder maths, stateMachine, validation, overview
  _data/           fixtures (retailers, SKU Master, order history)
  _components/     Shell (gate + sidebar), DemoProvider, shared (badges), WorkflowPieces (trace/approval)
  retailers/[id]/  the analyse → approve journey
  executions/      session-only run history
  orders/          empty (no orders created yet)
  workflow/        Implemented now / Being connected / Future
  api/agent/analyse/route.js   secure proxy → n8n
  api/agent/_n8n.js            server-side forwarder (secrets live here)
```

## Run & password

`npm run dev` → `http://localhost:3000/demo`. Password: **`ascend2026`**
(change: `printf 'NEW' | shasum -a 256` → paste into `PASSWORD_HASH` in `_components/Shell.jsx`).

## Environment variables (server-side only)

```env
N8N_ANALYSE_WEBHOOK_URL=   # n8n analysis webhook
N8N_WEBHOOK_SECRET=        # sent as X-Ascend-Webhook-Secret
```

The browser only calls `/demo/api/agent/analyse`; the URL + secret never reach the client bundle.
The proxy only validates, forwards, applies timeout/error handling, and checks the minimum response
shape. It never calls OpenAI, reads Sheets, computes signals, or invents fallback data.

## Analysis response contract (n8n → frontend)

```
{ executionId, orchestrator:'n8n'|'local_simulation', dataSource:'fixture'|'google_sheets',
  status:'AWAITING_HUMAN_APPROVAL',
  retailer:{ outletId, retailerName, location, phoneMasked, preferredLanguage, paymentPreference, darkStore },
  analysisFacts:{ deliveredOrderCount, validLineItemCount, recurringSkuCount },
  skuSignals:[{ skuCode, skuName, brand, unit, retailerPrice, purchaseCount, typicalCycleDays,
                daysSinceLastPurchase, signalStatus, suggestedQuantity, evidenceStrength }],
  recommendation:{ decision, confidence:0..1, businessReason, selectedItems:[{skuCode,quantity}] },
  basket:{ items:[{ skuCode, skuName, quantity, unit, retailerPrice, lineValue }], basketSummary, basketValue },
  templateVariables:{ retailerName, basketSummary, basketValue },
  trace:[{ step, type:'CODE'|'GOOGLE SHEETS'|'FIXTURE'|'AI'|'TOOL'|'HUMAN', status, detail? }] }
```

The frontend renders these verbatim in Live mode (no recomputation) and fails visibly if
`retailer`, `recommendation`, or `basket` is missing.

## Not built yet (shown as Future on the Workflow page)

Approved WhatsApp send, Interakt, inbound retailer replies, order creation, dark-store/rider
handoff, voice escalation. The WhatsApp **preview** (approved Hindi template) is shown for context
only — no message is sent, and no sent/accepted/delivered/replied status is ever displayed.
See [`APPS_SCRIPT.md`](./APPS_SCRIPT.md) for the future send-path runbook.

## Command Centre

Aggregate figures are computed from the local fixture dataset (badged `DEMO DATASET`) — not live n8n
data. Only the selected retailer's analysis runs through n8n in Live mode.
