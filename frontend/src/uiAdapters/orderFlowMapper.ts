import { 
  DeliveryRecoveryState,
  PhysicalOrderState, 
  PHYSICAL_FLOW_SEQUENCE,
  ReturnOrderState,
  TerminalOrderState,
  RefundState
} from "../domain/orderStateMachine";
import { isReversionStatus } from "../domain/stateReversion";
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Undo2,
  Calendar,
  Warehouse,
  ClipboardList,
  BadgeCheck,
  PackageCheck,
  ShoppingBag,
  FileSearch,
  CheckCircle,
  XCircle
} from "lucide-react";

export interface FlowNode {
  id: string;
  type: "orderStep";
  data: {
    label: string;
    key: string;
    state: "completed" | "active" | "upcoming" | "terminated" | "warning";
    reason?: string | null;
    isHeartbeat?: boolean;
    icon?: any;
    timestamp?: string;
    byline?: string;
  };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
  label?: string;
  type?: string;
  pathOptions?: { borderRadius: number };
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * UI Adapter: Converts Backend Order state to UI Graph (Nodes/Edges)
 * Strictly follows the Approved 5-Flow Logic with High-Density wrapping.
 */
export const mapOrderToGraph = (order: any, containerWidth: number = 1200): FlowGraph => {
  const { status, status_history = [] } = order;
  const historyStatuses = status_history.map((h: any) => h.status);
  
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Spacing Configuration 
  const NODE_SPACING_X = 170; // 7 steps per row
  const ROW_SPACING_Y = 300; 
  const PADDING_X = 240; // High-density safety margin to prevent cutting

  const maxNodesPerRow = Math.max(1, Math.floor((containerWidth - PADDING_X) / NODE_SPACING_X));
  let currentGlobalIndex = 0;

  const getPosition = (index: number) => {
    const row = Math.floor(index / maxNodesPerRow);
    let col = index % maxNodesPerRow;

    // Serpentine: Reverse direction for odd rows
    if (row % 2 !== 0) {
      col = (maxNodesPerRow - 1) - col;
    }

    return {
      x: col * NODE_SPACING_X,
      y: row * ROW_SPACING_Y
    };
  };

  // 1. Identify Physical Track Bounds & Branch Points
  const isCancelled = status.includes("cancelled");
  const deliveryRecoveryStatuses = [
    DeliveryRecoveryState.DELIVERY_UNSUCCESSFUL,
    DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED,
    DeliveryRecoveryState.RTO_IN_TRANSIT,
    DeliveryRecoveryState.RETURNED_TO_ORIGIN,
  ];
  const isFailed = deliveryRecoveryStatuses.includes(status as DeliveryRecoveryState) || historyStatuses.includes(DeliveryRecoveryState.DELIVERY_UNSUCCESSFUL);
  const isReturned =
    (status.includes("return") || historyStatuses.includes("return_requested")) &&
    !isReversionStatus(status) &&
    ![DeliveryRecoveryState.RETURNED_TO_ORIGIN].includes(status as DeliveryRecoveryState);

  // Find the furthest physical state reached in reality
  const reachedHistoryIndices = historyStatuses
      .map((s: string) => PHYSICAL_FLOW_SEQUENCE.indexOf(s as PhysicalOrderState))
      .filter((i: number) => i !== -1);
  
  const lastPhysicalIndex = reachedHistoryIndices.length > 0 
      ? Math.max(...reachedHistoryIndices) 
      : 0;

  // For cancelled/failed orders, the physical track stops at the branch point
  const physicalTrackLimit = (isCancelled || isFailed) 
      ? lastPhysicalIndex 
      : PHYSICAL_FLOW_SEQUENCE.length - 1;

  // 1. Build Physical Track
  const physicalStatesToShow = PHYSICAL_FLOW_SEQUENCE.slice(0, physicalTrackLimit + 1);
  
  physicalStatesToShow.forEach((state, index) => {
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(state, pos.x, pos.y, order));
    
    if (index > 0) {
      edges.push(createEdge(physicalStatesToShow[index - 1], state, order));
    }
    currentGlobalIndex++;
  });

  // 2. Cancellation Path (Branch from last physical state)
  if (isCancelled) {
    const cancelNodeId = status;
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(cancelNodeId, pos.x, pos.y, order));
    
    // Link from the Physical Branch Point
    const branchPointId = PHYSICAL_FLOW_SEQUENCE[lastPhysicalIndex];
    edges.push(createEdge(branchPointId, cancelNodeId, order));
    currentGlobalIndex++;

    // Add Refund Flow after Cancellation if it exists in history or is expected
    const refundEvent = status_history.find((h: any) => h.status === RefundState.REFUND_INITIATED || h.status === RefundState.REFUNDED);
    if (refundEvent) {
        const refundPath = [RefundState.REFUND_INITIATED, ReturnOrderState.GATEWAY_PROCESSING, RefundState.REFUNDED];
        refundPath.forEach((refState, refIdx) => {
            const rPos = getPosition(currentGlobalIndex);
            nodes.push(createNode(refState, rPos.x, rPos.y, order));
            const prevId = refIdx === 0 ? cancelNodeId : refundPath[refIdx-1];
            edges.push(createEdge(prevId, refState, order));
            currentGlobalIndex++;
        });
    }
  }

  // 3. Delivery Unsuccessful Path
  if (isFailed) {
    const failNodeId = DeliveryRecoveryState.DELIVERY_UNSUCCESSFUL;
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(failNodeId, pos.x, pos.y, order));
    
    // Branch from the physical point reached
    const branchPointId = PHYSICAL_FLOW_SEQUENCE[lastPhysicalIndex];
    edges.push(createEdge(branchPointId, failNodeId, order));
    currentGlobalIndex++;

    const hasReattempt = status === DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED || historyStatuses.includes(DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED);
    if (hasReattempt) {
        const reattemptId = DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED;
        const retryPos = getPosition(currentGlobalIndex);
        nodes.push(createNode(reattemptId, retryPos.x, retryPos.y, order));
        edges.push(createEdge(failNodeId, reattemptId, order));
        currentGlobalIndex++;

        edges.push(createEdge(reattemptId, PhysicalOrderState.DELIVERED, order));
    }

    const hasRtoTransit = status === DeliveryRecoveryState.RTO_IN_TRANSIT || historyStatuses.includes(DeliveryRecoveryState.RTO_IN_TRANSIT);
    if (hasRtoTransit) {
        const rtoTransitId = DeliveryRecoveryState.RTO_IN_TRANSIT;
        const rtoPos = getPosition(currentGlobalIndex);
        nodes.push(createNode(rtoTransitId, rtoPos.x, rtoPos.y, order));
        edges.push(createEdge(hasReattempt ? DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED : failNodeId, rtoTransitId, order));
        currentGlobalIndex++;
    }

    const hasReturnedToOrigin = status === DeliveryRecoveryState.RETURNED_TO_ORIGIN || historyStatuses.includes(DeliveryRecoveryState.RETURNED_TO_ORIGIN);
    if (hasReturnedToOrigin) {
        const returnedToOriginId = DeliveryRecoveryState.RETURNED_TO_ORIGIN;
        const rtoDeliveredPos = getPosition(currentGlobalIndex);
        nodes.push(createNode(returnedToOriginId, rtoDeliveredPos.x, rtoDeliveredPos.y, order));
        edges.push(createEdge(hasRtoTransit ? DeliveryRecoveryState.RTO_IN_TRANSIT : (hasReattempt ? DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED : failNodeId), returnedToOriginId, order));
        currentGlobalIndex++;
    }
  }

  // 4. Return Track (Strict Path + QC)
  if (isReturned) {
    const returnPath = [
      ReturnOrderState.RETURN_REQUESTED,
      ReturnOrderState.RETURN_APPROVED,
      ReturnOrderState.PICKUP_SCHEDULED,
      ReturnOrderState.PICKUP_COMPLETED,
      ReturnOrderState.PICKED_UP,
      ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE,
    ];

    // Only process QC path if delivery attempt wasn't the source (handled in section 3)
    const qcPath = [
      ReturnOrderState.QC_INITIATED,
      ReturnOrderState.QC_PASSED,
      ReturnOrderState.QC_FAILED,
      RefundState.REFUND_INITIATED,
      ReturnOrderState.GATEWAY_PROCESSING,
      RefundState.REFUNDED
    ];

    const fullReturnPath = [...returnPath, ...qcPath].filter(rState => {
        // Special case for attempted/failed
        if (rState === ReturnOrderState.PICKUP_ATTEMPTED) return historyStatuses.includes(rState);
        return true;
    });

    fullReturnPath.forEach((rState, rIdx) => {
      const pos = getPosition(currentGlobalIndex);
      nodes.push(createNode(rState, pos.x, pos.y, order));
      
      const prevId = rIdx === 0 ? PhysicalOrderState.DELIVERED : fullReturnPath[rIdx-1];
      
      // Special Logic: Pickup Loop
      if (rState === ReturnOrderState.PICKUP_SCHEDULED && historyStatuses.includes(ReturnOrderState.PICKUP_ATTEMPTED)) {
           edges.push({
                id: `e-${ReturnOrderState.PICKUP_SCHEDULED}-${ReturnOrderState.PICKUP_ATTEMPTED}`,
                source: ReturnOrderState.PICKUP_SCHEDULED,
                target: ReturnOrderState.PICKUP_ATTEMPTED,
                animated: true,
                style: { stroke: '#f43f5e', strokeWidth: 5 },
                pathOptions: { borderRadius: 20 }
           });
           edges.push({
                id: `e-${ReturnOrderState.PICKUP_ATTEMPTED}-${ReturnOrderState.PICKUP_SCHEDULED}`,
                source: ReturnOrderState.PICKUP_ATTEMPTED,
                target: ReturnOrderState.PICKUP_SCHEDULED,
                animated: true,
                type: 'smoothstep',
                style: { stroke: '#10b981', strokeWidth: 5 },
                pathOptions: { borderRadius: 20 }
           });
      }

      edges.push(createEdge(prevId, rState, order));
      currentGlobalIndex++;
    });

    // Handle Return Reject/Cancel/Failed branches
    if (status === ReturnOrderState.RETURN_REJECTED || historyStatuses.includes(ReturnOrderState.RETURN_REJECTED)) {
         const pos = getPosition(currentGlobalIndex);
         nodes.push(createNode(ReturnOrderState.RETURN_REJECTED, pos.x, pos.y, order));
         edges.push(createEdge(ReturnOrderState.RETURN_REQUESTED, ReturnOrderState.RETURN_REJECTED, order));
         currentGlobalIndex++;
    }

    if (status === ReturnOrderState.RETURN_CANCELLED || historyStatuses.includes(ReturnOrderState.RETURN_CANCELLED)) {
         const pos = getPosition(currentGlobalIndex);
         nodes.push(createNode(ReturnOrderState.RETURN_CANCELLED, pos.x, pos.y, order));
         edges.push(createEdge(ReturnOrderState.RETURN_APPROVED, ReturnOrderState.RETURN_CANCELLED, order));
         currentGlobalIndex++;
    }

    if (status === ReturnOrderState.PICKUP_FAILED || historyStatuses.includes(ReturnOrderState.PICKUP_FAILED)) {
         const pos = getPosition(currentGlobalIndex);
         nodes.push(createNode(ReturnOrderState.PICKUP_FAILED, pos.x, pos.y, order));
         const source = historyStatuses.includes(ReturnOrderState.PICKUP_ATTEMPTED) 
             ? ReturnOrderState.PICKUP_ATTEMPTED 
             : ReturnOrderState.PICKUP_SCHEDULED;
         edges.push(createEdge(source, ReturnOrderState.PICKUP_FAILED, order));
         currentGlobalIndex++;
    }

    // Handle Terminal Outcomes (QC Failed paths)
    if ([ReturnOrderState.PARTIAL_REFUND, ReturnOrderState.ZERO_REFUND, ReturnOrderState.RETURN_TO_CUSTOMER, ReturnOrderState.DISPOSE].includes(status as ReturnOrderState)) {
        const pos = getPosition(currentGlobalIndex);
        nodes.push(createNode(status, pos.x, pos.y, order));
        edges.push(createEdge(ReturnOrderState.QC_FAILED, status, order));
        currentGlobalIndex++;

        // If Partial Refund, link back to financial flow
        if (status === ReturnOrderState.PARTIAL_REFUND) {
             const refNodeId = RefundState.REFUND_INITIATED;
             // Check if already in nodes to avoid duplicates
             if (!nodes.find(n => n.id === refNodeId)) {
                const refPos = getPosition(currentGlobalIndex);
                nodes.push(createNode(refNodeId, refPos.x, refPos.y, order));
                edges.push(createEdge(status, refNodeId, order));
                currentGlobalIndex++;
             } else {
                edges.push(createEdge(status, refNodeId, order));
             }
        }
    }
  }

  return { nodes, edges };
};


const PHYSICAL_FLOW_INDEX = new Map<string, number>(
  PHYSICAL_FLOW_SEQUENCE.map((state, index) => [state, index])
);

const RETURN_FLOW_SEQUENCE_FOR_PROGRESS = [
  ReturnOrderState.RETURN_REQUESTED,
  ReturnOrderState.RETURN_APPROVED,
  ReturnOrderState.PICKUP_SCHEDULED,
  ReturnOrderState.PICKUP_ATTEMPTED,
  ReturnOrderState.PICKUP_COMPLETED,
  ReturnOrderState.PICKED_UP,
  ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE,
  ReturnOrderState.QC_INITIATED,
  ReturnOrderState.QC_PASSED,
  ReturnOrderState.QC_FAILED,
  ReturnOrderState.PARTIAL_REFUND,
  ReturnOrderState.ZERO_REFUND,
  ReturnOrderState.RETURN_TO_CUSTOMER,
  ReturnOrderState.DISPOSE,
  RefundState.REFUND_INITIATED,
  RefundState.REFUNDED,
];

const RETURN_FLOW_INDEX = new Map<string, number>(
  RETURN_FLOW_SEQUENCE_FOR_PROGRESS.map((state, index) => [state, index])
);

const hasReachedPhysicalState = (state: string, currentStatus: string, historyStatuses: string[]) => {
  if (historyStatuses.includes(state)) {
    return true;
  }

  const stateIndex = PHYSICAL_FLOW_INDEX.get(state);
  if (stateIndex === undefined) {
    return false;
  }

  const currentPhysicalIndex = PHYSICAL_FLOW_INDEX.get(currentStatus);
  if (currentPhysicalIndex !== undefined) {
    return currentPhysicalIndex >= stateIndex;
  }

  if (currentStatus === "delivery_unsuccessful") {
    const branchIndex = PHYSICAL_FLOW_INDEX.get(PhysicalOrderState.OUT_FOR_DELIVERY) ?? -1;
    return branchIndex >= stateIndex;
  }

  if ([DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED, DeliveryRecoveryState.RTO_IN_TRANSIT, DeliveryRecoveryState.RETURNED_TO_ORIGIN].includes(currentStatus as DeliveryRecoveryState)) {
    const branchIndex = PHYSICAL_FLOW_INDEX.get(PhysicalOrderState.OUT_FOR_DELIVERY) ?? -1;
    return branchIndex >= stateIndex;
  }

  const cancelStates = new Set<string>([
    TerminalOrderState.CANCELLED_BY_ADMIN,
    TerminalOrderState.CANCELLED_BY_CUSTOMER,
  ]);

  if (cancelStates.has(currentStatus)) {
    // For cancelled orders, we rely on history to see how far we got
    const reachedHistoryIndices = historyStatuses
      .map((s: string) => PHYSICAL_FLOW_INDEX.get(s))
      .filter((i: number | undefined): i is number => i !== undefined);
    
    const lastReached = reachedHistoryIndices.length > 0 ? Math.max(...reachedHistoryIndices) : 0;
    return stateIndex <= lastReached;
  }

  const returnOrTerminalStates = new Set<string>([
    TerminalOrderState.RETURNED,
    TerminalOrderState.PARTIALLY_RETURNED,
    ReturnOrderState.RETURN_REQUESTED,
    ReturnOrderState.RETURN_APPROVED,
    ReturnOrderState.PICKUP_SCHEDULED,
    ReturnOrderState.PICKUP_ATTEMPTED,
    ReturnOrderState.PICKUP_COMPLETED,
    ReturnOrderState.PICKED_UP,
    ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE,
    ReturnOrderState.QC_INITIATED,
    ReturnOrderState.QC_PASSED,
    ReturnOrderState.QC_FAILED,
    ReturnOrderState.PARTIAL_REFUND,
    ReturnOrderState.ZERO_REFUND,
    ReturnOrderState.RETURN_TO_CUSTOMER,
    ReturnOrderState.DISPOSE,
    RefundState.REFUND_INITIATED,
    RefundState.REFUNDED,
  ]);


  if (returnOrTerminalStates.has(currentStatus)) {
    const deliveredIndex = PHYSICAL_FLOW_INDEX.get(PhysicalOrderState.DELIVERED) ?? -1;
    return deliveredIndex >= stateIndex;
  }

  return false;
};

const hasReachedReturnState = (state: string, currentStatus: string, historyStatuses: string[]) => {
  if (historyStatuses.includes(state)) {
    return true;
  }

  const stateIndex = RETURN_FLOW_INDEX.get(state);
  const currentIndex = RETURN_FLOW_INDEX.get(currentStatus);

  if (stateIndex === undefined || currentIndex === undefined) {
    return false;
  }

  return currentIndex >= stateIndex;
};

const createNode = (state: string, x: number, y: number, order: any): FlowNode => {
  const { status, status_history = [], created_at } = order;
  const historyStatuses = status_history.map((h: any) => h.status);
  let entry = status_history.find((h: any) => h.status === state);
  
  // Fallback for 'pending' state: if no explicit history entry exists, use order creation date
  if (!entry && state === PhysicalOrderState.PENDING) {
    entry = { created_at };
  }
  
  const isTerminalStatus =
    status.includes("cancel") ||
    status.includes("rejected") ||
    status === DeliveryRecoveryState.RETURNED_TO_ORIGIN ||
    status === ReturnOrderState.ZERO_REFUND ||
    status === ReturnOrderState.DISPOSE;

  let nodeState: FlowNode["data"]["state"] = "upcoming";
  if (status === state) {
    nodeState = isTerminalStatus ? "terminated" : "active";
  } else if (
    hasReachedPhysicalState(state, status, historyStatuses) ||
    hasReachedReturnState(state, status, historyStatuses)
  ) {
    nodeState = "completed";
  } else if (isTerminalStatus) {
    nodeState = "terminated";
  }

  // Special override for 'warning' states e.g. delivery_unsuccessful
  if (state === DeliveryRecoveryState.DELIVERY_UNSUCCESSFUL && (status === state || historyStatuses.includes(state))) {
    nodeState = "warning";
  }

  return {
    id: state,
    type: "orderStep",
    data: {
      label: formatLabel(state),
      key: state,
      state: nodeState,
      reason: entry?.notes,
      timestamp: formatTimestamp(entry?.created_at),
      byline: formatByline(state),
      isHeartbeat: status === state,
      icon: getIconForState(state)
    },
    position: { x, y }
  };
};

const createEdge = (source: string, target: string, order: any): FlowEdge => {
  const { status, status_history = [] } = order;
  const historyStatuses = status_history.map((h: any) => h.status);
  const isPassed = historyStatuses.includes(target) || status === target;

  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: !isPassed,
    type: 'smoothstep',
    style: { 
        stroke: isPassed ? "#10b981" : "#e2e8f0", 
        strokeWidth: 6,
        opacity: isPassed ? 1 : 0.6
    },
    pathOptions: { borderRadius: 30 }
  };
};

const getIconForState = (state: string) => {
    switch (state) {
        case PhysicalOrderState.PENDING: return ShoppingBag;
        case PhysicalOrderState.CONFIRMED: return BadgeCheck;
        case PhysicalOrderState.PROCESSING: return ClipboardList;
        case PhysicalOrderState.PACKED: return PackageCheck;
        case PhysicalOrderState.SHIPPED: return Truck;
        case PhysicalOrderState.OUT_FOR_DELIVERY: return MapPin;
        case PhysicalOrderState.DELIVERED: return CheckCircle2;
        case DeliveryRecoveryState.DELIVERY_REATTEMPT_SCHEDULED: return Calendar;
        case DeliveryRecoveryState.RTO_IN_TRANSIT: return Truck;
        case DeliveryRecoveryState.RETURNED_TO_ORIGIN: return Warehouse;
        case ReturnOrderState.RETURN_REQUESTED: return Undo2;
        case ReturnOrderState.RETURN_APPROVED: return CheckCircle2;
        case ReturnOrderState.PICKUP_SCHEDULED: return Calendar;
        case ReturnOrderState.PICKUP_ATTEMPTED: return AlertCircle;
        case ReturnOrderState.PICKUP_FAILED: return XCircle;
        case ReturnOrderState.PICKUP_COMPLETED: return BadgeCheck;
        case ReturnOrderState.PICKED_UP: return Package;
        case ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE: return Truck;
        case ReturnOrderState.QC_INITIATED: return FileSearch;
        case ReturnOrderState.QC_PASSED: return CheckCircle;
        case ReturnOrderState.QC_FAILED: return XCircle;
        case ReturnOrderState.RETURN_REJECTED: return XCircle;
        case ReturnOrderState.RETURN_CANCELLED: return XCircle;
        case ReturnOrderState.PARTIAL_REFUND: return RotateCcw;
        case ReturnOrderState.ZERO_REFUND: return XCircle;
        case ReturnOrderState.GATEWAY_PROCESSING: return RotateCcw;
        case 'razorpay_processing': return RotateCcw;
        case ReturnOrderState.RETURN_TO_CUSTOMER: return Truck;
        case ReturnOrderState.DISPOSE: return XCircle;
        case TerminalOrderState.RETURNED: return Warehouse;
        case TerminalOrderState.PARTIALLY_RETURNED: return Warehouse;
        case TerminalOrderState.CANCELLED_BY_ADMIN: return XCircle;
        case TerminalOrderState.CANCELLED_BY_CUSTOMER: return XCircle;
        case RefundState.REFUND_INITIATED: return RotateCcw;
        case RefundState.REFUNDED: return ShieldCheck;
        case DeliveryRecoveryState.DELIVERY_UNSUCCESSFUL: return AlertCircle;
        default: return HelpCircle;
    }
};

const formatLabel = (state: string) => {
    switch(state) {
      case 'pending': return "Order Placed";
      case 'confirmed': return "Order Confirmed";
      case 'processing': return "Order Processing";
      case 'packed': return "Order Packed";
      case 'shipped': return "Order Shipped";
      case 'out_for_delivery': return "Out for Delivery";
      case 'delivered': return "Order Delivered";
      case 'razorpay_processing': return "Gateway Processing";
      case 'delivery_reattempt_scheduled': return "Reattempt Scheduled";
      case 'rto_in_transit': return "RTO In Transit";
      case 'returned_to_origin': return "Returned to Origin";
      case 'return_requested': return "Return Requested";
      case 'return_rejected': return "Return Rejected";
      case 'return_approved': return "Return Approved";
      case 'return_cancelled': return "Return Cancelled";
      case 'return_pickup_scheduled': return "Pickup Scheduled";
      case 'pickup_attempted': return "Pickup Attempted";
      case 'pickup_failed': return "Pickup Failed";
      case 'pickup_completed': return "Pickup Completed";
      case 'picked_up': return "Picked Up";
      case 'in_transit_to_warehouse': return "Transit to Lab";
      case 'qc_initiated': return "Quality Audit";
      case 'qc_passed': return "QC Passed";
      case 'qc_failed': return "QC Failed";
      case 'partial_refund': return "Partial Refund Approved";
      case 'zero_refund': return "No Refund Eligible";
      case 'gateway_processing': return "Gateway Processing";
      case 'return_to_customer': return "Return to Sender";
      case 'dispose_liquidate': return "Dispose/Liquidate";
      case 'refund_initiated': return "Refund Triggered";
      case 'refunded': return "Refund Success";
      case 'cancelled_by_admin': return "Admin Cancelled";
      case 'cancelled_by_customer': return "Customer Cancelled";
      case 'delivery_unsuccessful': return "Delivery Unsuccessful";
      case 'returned': return "Returned";
      case 'partially_returned': return "Partially Returned";
      default: return state.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
};

const formatByline = (state: string) => {
    switch(state) {
      case 'pending': return "Order Received";
      case 'confirmed': return "Verified & Confirmed";
      case 'processing': return "Order Processing";
      case 'packed': return "Packed with Care";
      case 'shipped': return "En Route to Destination";
      case 'out_for_delivery': return "Arriving at your Doorstep";
      case 'delivered': return "Successfully Delivered";
      case 'return_requested': return "Return request being reviewed";
      case 'return_approved': return "Return has been authorized";
      case 'qc_passed': return "Quality Audit Cleared";
      case 'qc_failed': return "Issue detected during audit";
      case 'refunded': return "Amount credited back";
      case 'cancelled_by_admin': return "Order revoked by system";
      case 'cancelled_by_customer': return "Order revoked by you";
      case 'delivery_unsuccessful': return "RTO in progress";
      default: return undefined;
    }
};

const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
    });
};
