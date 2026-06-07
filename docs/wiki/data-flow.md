# Data Flow

## Inbound Message

```mermaid
sequenceDiagram
  participant C as Channel
  participant R as Router
  participant D as Central DB
  participant I as inbound.db
  participant S as Sweep
  participant M as Runner Manager
  participant A as Runner
  participant O as outbound.db
  participant V as Delivery

  C->>R: inbound event
  R->>D: resolve messaging group and wiring
  R->>D: resolve or create session
  R->>I: insert messages_in row
  S->>I: count due messages
  S->>M: wake runner
  M->>A: spawn host process
  A->>I: read pending rows
  A->>O: mark processing
  A->>A: call provider
  A->>O: write messages_out
  A->>O: mark completed
  V->>O: read due outbound
  V->>C: deliver reply
```

## Failure And Retry

- If a runner exits before marking a message completed, `processing_ack` remains
  in `processing`.
- `host-sweep` compares claim age and heartbeat age.
- Stuck claims are reset with backoff until `MAX_TRIES`.
- Failed outbound delivery is tracked in `inbound.db.delivered` so retries do
  not duplicate successful messages.

## Sequence Numbers

- Host-written inbound rows use even `seq` values.
- Runner-written outbound rows use odd `seq` values.
- This keeps message references stable across the two DB files.
