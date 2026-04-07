# em trigger issues-cmd

### Purpose

Connect a trigger to a command using `processorOrTriggerIssuesCommand`.

### Syntax

```bash
em trigger issues-cmd --trigger <triggerId> --cmd <cmdId>
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_602",
    "type": "processorOrTriggerIssuesCommand",
    "fromNodeId": "order.payment.trigger.webhook.stripe-event",
    "toNodeId": "order.payment.cmd.capture-charge"
  }
}
```

### Example

```bash
em trigger issues-cmd --trigger order.payment.trigger.webhook.stripe-event --cmd order.payment.cmd.capture-charge
```

```json
{
  "ok": true,
  "command": "em trigger issues-cmd",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_602",
      "type": "processorOrTriggerIssuesCommand",
      "fromNodeId": "order.payment.trigger.webhook.stripe-event",
      "toNodeId": "order.payment.cmd.capture-charge"
    }
  },
  "warnings": []
}
```