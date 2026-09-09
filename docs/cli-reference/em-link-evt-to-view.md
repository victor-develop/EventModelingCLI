# em link evt->view

### Purpose

Create an `eventRefreshesViewModel` edge.

### Syntax

```bash
em link evt->view <evtId> <viewModelId>
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_502",
    "type": "eventRefreshesViewModel",
    "fromNodeId": "order.refund.evt.refund.created",
    "toNodeId": "order.payment.view.charge.detail"
  }
}
```

### Example

```bash
em link evt->view order.refund.evt.refund.created order.payment.view.charge.detail
```

```json
{
  "ok": true,
  "command": "em link evt->view",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_502",
      "type": "eventRefreshesViewModel",
      "fromNodeId": "order.refund.evt.refund.created",
      "toNodeId": "order.payment.view.charge.detail"
    }
  },
  "warnings": []
}
```