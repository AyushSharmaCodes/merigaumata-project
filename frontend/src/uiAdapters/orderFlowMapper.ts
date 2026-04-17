import { 
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
    state: "completed" | "active" | "upcoming" | "terminated";
    reason?: string | null;
    isHeartbeat?: boolean;
    icon?: any;
    timestamp?: string;
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
  const PADDING_X = 40;

  const maxNodesPerRow = Math.max(1, Math.floor((containerWidth - PADDING_X) / NODE_SPACING_X));
  let currentGlobalIndex = 0;

  const getPosition = (index: number) => {
    const row = Math.floor(index / maxNodesPerRow);
    const col = index % maxNodesPerRow;
    return {
      x: col * NODE_SPACING_X,
      y: row * ROW_SPACING_Y
    };
  };

  // 1. Build Physical Track
  const isCancelled = status.includes("cancelled");
  const isFailed = status === "delivery_unsuccessful" || historyStatuses.includes("delivery_unsuccessful");
  const isReturned = (status.includes("return") || historyStatuses.includes("return_requested")) && !isReversionStatus(status);

  PHYSICAL_FLOW_SEQUENCE.forEach((state, index) => {
    if (isCancelled && index > 3) return; // Cut off at PACKED if cancelled
    
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(state, pos.x, pos.y, order));
    
    if (currentGlobalIndex > 0) {
      edges.push(createEdge(nodes[currentGlobalIndex-1].id, state, order));
    }
    currentGlobalIndex++;
  });

  // 2. Cancellation Path
  if (isCancelled) {
    const cancelNodeId = status;
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(cancelNodeId, pos.x, pos.y, order));
    edges.push(createEdge(nodes[currentGlobalIndex-1].id, cancelNodeId, order));
    currentGlobalIndex++;
  }

  // 3. Delivery Unsuccessful Path
  if (isFailed) {
    const failNodeId = "delivery_unsuccessful";
    const pos = getPosition(currentGlobalIndex);
    nodes.push(createNode(failNodeId, pos.x, pos.y, order));
    // Branch from OUT_FOR_DELIVERY if existed, else SHIPPED
    const branchPoint = historyStatuses.includes(PhysicalOrderState.OUT_FOR_DELIVERY) ? PhysicalOrderState.OUT_FOR_DELIVERY : PhysicalOrderState.SHIPPED;
    edges.push(createEdge(branchPoint, failNodeId, order));
    // Transitions to Returned
    if (status.includes("returned")) {
        const terminalReturnId = status;
        const terminalPos = getPosition(currentGlobalIndex + 1);
        nodes.push(createNode(terminalReturnId, terminalPos.x, terminalPos.y, order));
        edges.push(createEdge(failNodeId, terminalReturnId, order));
        currentGlobalIndex += 2;
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
      ReturnOrderState.QC_INITIATED,
      ReturnOrderState.QC_PASSED,
      ReturnOrderState.QC_FAILED,
      RefundState.REFUND_INITIATED,
      RefundState.REFUNDED
    ].filter(rState => {
        // Only show historical branch nodes like PICKUP_ATTEMPTED if they occurred
        if (rState === ReturnOrderState.PICKUP_ATTEMPTED) return historyStatuses.includes(rState);
        return true;
    });

    returnPath.forEach((rState, rIdx) => {
      const pos = getPosition(currentGlobalIndex);
      nodes.push(createNode(rState, pos.x, pos.y, order));
      
      const prevId = rIdx === 0 ? PhysicalOrderState.DELIVERED : returnPath[rIdx-1];
      
      // Special Logic: Pickup Loop & Reversion
      if (rState === ReturnOrderState.PICKUP_SCHEDULED && historyStatuses.includes(ReturnOrderState.PICKUP_ATTEMPTED)) {
           edges.push({
                id: `e-${ReturnOrderState.PICKUP_SCHEDULED}-${ReturnOrderState.PICKUP_ATTEMPTED}`,
                source: ReturnOrderState.PICKUP_SCHEDULED,
                target: ReturnOrderState.PICKUP_ATTEMPTED,
                animated: true,
                style: { stroke: '#f43f5e', strokeWidth: 5 },
                pathOptions: { borderRadius: 20 }
           });
           // Re-schedule path
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

    // Handle Branching Terminal Outcomes (QC Failed paths)
    if (status === ReturnOrderState.PARTIAL_REFUND || status === ReturnOrderState.ZERO_REFUND || status === ReturnOrderState.RETURN_TO_CUSTOMER || status === ReturnOrderState.DISPOSE) {
        const pos = getPosition(currentGlobalIndex);
        nodes.push(createNode(status, pos.x, pos.y, order));
        edges.push(createEdge(ReturnOrderState.QC_FAILED, status, order));
        currentGlobalIndex++;

        // If Partial Refund, link to financial flow
        if (status === ReturnOrderState.PARTIAL_REFUND) {
             const refNodeId = RefundState.REFUND_INITIATED;
             const refPos = getPosition(currentGlobalIndex);
             nodes.push(createNode(refNodeId, refPos.x, refPos.y, order));
             edges.push(createEdge(status, refNodeId, order));
             currentGlobalIndex++;
        }
    }
}

  // 5. Refund Flow (Standardized Sequence)
  const isRefundable = [
    TerminalOrderState.CANCELLED_BY_ADMIN,
    TerminalOrderState.CANCELLED_BY_CUSTOMER,
    TerminalOrderState.PARTIALLY_RETURNED,
    TerminalOrderState.RETURNED
  ].includes(status as TerminalOrderState);

  const refundEvent = status_history.find((h: any) => h.status === RefundState.REFUND_INITIATED || h.status === RefundState.REFUNDED);

  if (isRefundable && refundEvent) {
    const refundPath = [RefundState.REFUND_INITIATED, RefundState.REFUNDED];
    refundPath.forEach((refState, refIdx) => {
        const pos = getPosition(currentGlobalIndex);
        nodes.push(createNode(refState, pos.x, pos.y, order));
        const prevId = refIdx === 0 ? status : refundPath[refIdx-1];
        edges.push(createEdge(prevId, refState, order));
        currentGlobalIndex++;
    });
  }

  return { nodes, edges };
};

const createNode = (state: string, x: number, y: number, order: any): FlowNode => {
  const { status, status_history = [] } = order;
  const historyStatuses = status_history.map((h: any) => h.status);
  const entry = status_history.find((h: any) => h.status === state);
  
  let nodeState: FlowNode["data"]["state"] = "upcoming";
  if (status === state) {
    nodeState = "active";
  } else if (historyStatuses.includes(state)) {
    nodeState = "completed";
  } else if (status.includes("cancel") || status.includes("fail") || status.includes("rejected")) {
    nodeState = "terminated";
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
      isHeartbeat: nodeState === "active",
      icon: getIconForState(state)
    },
    position: { x, y }
  };
};

const createEdge = (source: string, target: string, order: any): FlowEdge => {
  const { status_history = [] } = order;
  const historyStatuses = status_history.map((h: any) => h.status);
  const isPassed = historyStatuses.includes(target);

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
        case ReturnOrderState.RETURN_REQUESTED: return Undo2;
        case ReturnOrderState.RETURN_APPROVED: return CheckCircle2;
        case ReturnOrderState.PICKUP_SCHEDULED: return Calendar;
        case ReturnOrderState.PICKUP_ATTEMPTED: return AlertCircle;
        case ReturnOrderState.PICKUP_COMPLETED: return BadgeCheck;
        case ReturnOrderState.PICKED_UP: return Package;
        case ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE: return Truck;
        case ReturnOrderState.QC_INITIATED: return FileSearch;
        case ReturnOrderState.QC_PASSED: return CheckCircle;
        case ReturnOrderState.QC_FAILED: return XCircle;
        case ReturnOrderState.GATEWAY_PROCESSING: return RotateCcw;
        case ReturnOrderState.RETURN_TO_CUSTOMER: return Truck;
        case ReturnOrderState.DISPOSE: return XCircle;
        case TerminalOrderState.RETURNED: return Warehouse;
        case TerminalOrderState.PARTIALLY_RETURNED: return Warehouse;
        case TerminalOrderState.CANCELLED_BY_ADMIN: return XCircle;
        case TerminalOrderState.CANCELLED_BY_CUSTOMER: return XCircle;
        case RefundState.REFUND_INITIATED: return RotateCcw;
        case RefundState.REFUNDED: return ShieldCheck;
        case "delivery_unsuccessful": return AlertCircle;
        default: return HelpCircle;
    }
};

const formatLabel = (state: string) => {
    switch(state) {
      case 'pending': return "Order Placed";
      case 'confirmed': return "Payment Success";
      case 'processing': return "Order Confirmed";
      case 'packed': return "Order Processing";
      case 'shipped': return "Order Packed";
      case 'out_for_delivery': return "Shipped & In Transit";
      case 'delivered': return "Order Delivered";
      case 'return_pickup_scheduled': return "Pickup Scheduled";
      case 'pickup_completed': return "Pickup Successful";
      case 'picked_up': return "Physical Retrieval";
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
      case 'delivery_unsuccessful': return "RTO (Undelivered)";
      default: return state.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
};

const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
    });
};
