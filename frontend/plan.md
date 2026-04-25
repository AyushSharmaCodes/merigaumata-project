# Flow Validation Plan

1. **Delivery Unsuccessful Path**
   - Diagram: `DU --> RS --> F` (REATTEMPT_SCHEDULED to OUT_FOR_DELIVERY) and `DU --> RTO` (RTO_IN_TRANSIT).
   - Fix:
     - Change link from `REATTEMPT_SCHEDULED` to `PhysicalOrderState.OUT_FOR_DELIVERY` instead of `DELIVERED`.
     - Change link to `RTO_IN_TRANSIT` to branch from `DELIVERY_UNSUCCESSFUL`, not `REATTEMPT_SCHEDULED`. (Wait, if reattempt fails, it branches from DU? Let's trace it. DU is a state. It can go to RS, or RTO. So `edges.push(createEdge(failNodeId, rtoTransitId, order))` is correct for RTO).

2. **Return Tracking (Pickup Attempted & Failed)**
   - Diagram: `PS --> PA`, `PA --> PS`, `PS --> PF`, `PA --> PF`, `PF --> G`.
   - Fix:
     - `PICKUP_ATTEMPTED` node needs to be dynamically added if it exists in history.
     - Add edges `PS --> PA` and `PA --> PS` (retry loop).
     - Add edge `PA --> PF` or `PS --> PF` if `PICKUP_FAILED` is reached.

3. **Return Rejections & Cancellations**
   - Diagram: `RR --> RRJ`, `RRJ --> G`, `RA --> RC`, `RC --> G`.
   - Fix:
     - Currently handled, but only if they are the `currentReturnStatus`.
     - Need to check if they are in `historyStatuses` OR `status` so they don't disappear if subsequent actions occur. Wait, these are terminal, so they are the last state. Checking `currentReturnStatus` might be fine, but better to check history.

4. **QC Outcomes & Refunds**
   - Diagram: `QC_FAILED --> PARTIAL_REFUND --> REFUND_INITIATED`. `QC_PASSED --> REFUND_INITIATED`.
   - Fix:
     - Separate `refundPath` from the main linear `qcPath`.
     - Evaluate `terminalOutcomes` based on `historyStatuses.includes(outcome) || status === outcome`.
     - Link `REFUND_INITIATED` dynamically from `PARTIAL_REFUND` or `QC_PASSED`.

