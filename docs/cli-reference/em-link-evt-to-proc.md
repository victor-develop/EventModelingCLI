# em link evt->proc

### Purpose

Create an `eventUpdatesProcessor` edge.

### Syntax

```bash
em link evt->proc <evtId> <procId>
```

Both arguments accept a node canonical id or node id.

### Expected `data`

```json
{
  "edge": {
    "id": "edge_503",
    "type": "eventUpdatesProcessor",
    "fromNodeId": "hotel.evt.room-booked",
    "toNodeId": "hotel.proc.booking-validator"
  }
}
```

### Example

```bash
em link evt->proc hotel.evt.room-booked hotel.proc.booking-validator
```

The processor may consume a view model with `em proc bind-view`; this link supplies the event that drives the processor.

```json
{
  "ok": true,
  "command": "em link evt->proc",
  "projectId": "proj_hotel-booking",
  "draftId": "draft_001",
  "data": {
    "edge": {
      "id": "edge_503",
      "type": "eventUpdatesProcessor",
      "fromNodeId": "hotel.evt.room-booked",
      "toNodeId": "hotel.proc.booking-validator"
    }
  },
  "warnings": []
}
```
