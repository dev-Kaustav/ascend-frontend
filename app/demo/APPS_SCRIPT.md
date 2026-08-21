# Apps Script runbook — single reorder-nudge endpoint (FUTURE)

> **Future integration — not wired yet.** The current demo stops at human approval; there is no send
> path, no `/demo/api/agent/send` route, and no Interakt call. This runbook describes the *planned*
> outbound flow for when it is built.
>
> Planned path: approved basket → n8n send webhook → **this** Apps Script `doPost` → Interakt.
> It will live in **your** Google account; the frontend will never hold Interakt credentials.

## What to reuse vs. add

You already have a tested Apps Script that authenticates with Interakt (via Script Properties),
maps Outlet IDs → phone numbers, normalises Indian numbers, sends approved templates, records
response IDs, updates Sheets, and prevents duplicate **delivered-order** notifications.

**Do not** call the existing bulk `order_delivered` scanner. **Do** add:

1. A new `doPost(e)` web-app entry point that accepts **one** approved reorder nudge.
2. A new single-message helper that sends a **new approved template** `reorder_recommendation_v1`
   (the `order_delivered` template cannot be reused for this).
3. An idempotency check against an `AI Agent Log` sheet so repeated sends with the same
   `idempotencyKey` do not double-send.

## Template `reorder_recommendation_v1`

Approve in Interakt with three body variables: (1) retailer name, (2) basket summary, (3) basket value.

## Expected request from n8n (forwarded send payload)

```json
{
  "event": "SEND_APPROVED_REORDER_NUDGE",
  "idempotencyKey": "idem_xxx",
  "executionId": "exec_xxx",
  "retailer": { "outletId": "RET-1027", "name": "Sharma Super Store", "phone": "+9198XXXXXXXX" },
  "basket": { "items": [/* … */], "expectedOrderValue": 2850 },
  "approvedMessage": "Namaste …"
}
```

## Skeleton

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const key = body.idempotencyKey;
  if (alreadyProcessed(key)) {
    return json({ messageStatus: 'provider_accepted', sheetStatus: 'logged', deduped: true });
  }
  const phone = normaliseIndianNumber(body.retailer.phone || lookupPhoneByOutlet(body.retailer.outletId));
  const vars = [
    body.retailer.name,
    body.basket.items.map(i => `${i.skuName} ${i.quantity}`).join(', '),
    '₹' + body.basket.expectedOrderValue,
  ];
  const resp = sendInteraktTemplate(phone, 'reorder_recommendation_v1', vars); // NEW single-message helper
  logAgentRow(key, body, resp);                                                // append to "AI Agent Log"
  return json({
    messageStatus: resp.ok ? 'provider_accepted' : 'failed', // never 'delivered'
    sheetStatus: 'logged', orderStatus: 'drafted', providerMessageId: resp.id,
  });
}

function alreadyProcessed(key) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('AI Agent Log');
  return sheet.getRange('A:A').getValues().flat().indexOf(key) !== -1;
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

## n8n wiring

- **Analyse workflow** (`N8N_ANALYSE_WEBHOOK_URL`): read order history + SKU Master from Sheets,
  compute reorder windows (mirror `app/demo/_lib/reorder.js`), return a normalized response with
  `recommendation` + `trace`. **Never** sends a message.
- **Send workflow** (`N8N_SEND_WEBHOOK_URL`): validate the secret header, forward to this Apps Script
  `doPost`, map its result into the normalized response (`messageStatus: provider_accepted`,
  `sheetStatus: logged`, `orderStatus: drafted`).
