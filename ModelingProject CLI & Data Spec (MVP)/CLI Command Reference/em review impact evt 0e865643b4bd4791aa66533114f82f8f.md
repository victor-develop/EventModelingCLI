# em review impact evt

### Purpose

Show the impact surface of one event.

### Syntax

```bash
em review impact evt <evtId>
```

### Expected `data`

```json
{
  "eventId": "order.refund.evt.refund.status-updated",
  "affectedViewModels": ["order.payment.view.charge.detail"],
  "affectedProcessors": ["order.payment.proc.charge.reconcile"],
  "affectedUiNodes": ["ui.section.payment.detail.refund-status"]
}
```

### Example

```bash
em review impact evt order.refund.evt.refund.status-updated
```

```json
{
  "ok": true,
  "command": "em review impact evt",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "eventId": "order.refund.evt.refund.status-updated",
    "affectedViewModels": ["order.payment.view.charge.detail"],
    "affectedProcessors": ["order.payment.proc.charge.reconcile"],
    "affectedUiNodes": ["ui.section.payment.detail.refund-status"]
  },
  "warnings": []
}
```