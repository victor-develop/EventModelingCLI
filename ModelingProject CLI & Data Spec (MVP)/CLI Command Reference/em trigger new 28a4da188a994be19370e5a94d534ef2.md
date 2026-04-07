# em trigger new

### Purpose

Create a trigger node.

### Syntax

```bash
em trigger new <canonicalId>
```

### Expected `data`

```json
{
  "node": {
    "id": "order.payment.trigger.webhook.stripe-event",
    "kind": "trigger",
    "canonicalId": "order.payment.trigger.webhook.stripe-event"
  }
}
```

### Example

```bash
em trigger new order.payment.trigger.webhook.stripe-event
```

```json
{
  "ok": true,
  "command": "em trigger new",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "order.payment.trigger.webhook.stripe-event",
      "kind": "trigger",
      "canonicalId": "order.payment.trigger.webhook.stripe-event"
    }
  },
  "warnings": []
}
```