import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position, 
  NodeProps, 
  Edge, 
  Node,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { mapOrderToGraph } from "@/uiAdapters/orderFlowMapper";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle
} from "lucide-react";
import React, { useMemo } from "react";

/**
 * Custom hook for measuring container width (Native ResizeObserver)
 */
const useMeasure = () => {
    const [width, setWidth] = React.useState(0);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setWidth(entries[0].contentRect.width);
            }
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return [ref, { width }] as const;
};

/**
 * Auto-Fitter Helper: Ensures the view is always centered and fitted
 */
const FlowAutoFitter = ({ nodes }: { nodes: Node[] }) => {
    const { fitView } = useReactFlow();

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            fitView({ 
                padding: 0.2, 
                duration: 400 
            });
        }, 100);
        return () => clearTimeout(timeout);
    }, [nodes, fitView]);

    return null;
};

/**
 * Custom Node for Order Steps
 * Milestone Tracker Design: Solid circles, labels below
 */
const OrderStepNode = ({ data }: NodeProps) => {
  const { label, state, isHeartbeat, reason, icon: CustomIcon, timestamp } = data as any;

  const getColors = () => {
    switch (state) {
      case "completed":
        return { 
          bg: "bg-emerald-600", 
          border: "border-emerald-600", 
          iconColor: "text-white",
          textColor: "text-slate-800",
          subTextColor: "text-slate-400",
          icon: <CheckCircle2 size={24} className="text-white" /> 
        };
      case "active":
        return { 
          bg: "bg-indigo-600", 
          border: "border-indigo-600", 
          iconColor: "text-white",
          textColor: "text-indigo-600",
          subTextColor: "text-indigo-400",
          icon: <Clock size={24} className="text-white" /> 
        };
      case "terminated":
        return { 
          bg: "bg-rose-600", 
          border: "border-rose-600", 
          iconColor: "text-white",
          textColor: "text-rose-600",
          subTextColor: "text-rose-400",
          icon: <XCircle size={24} className="text-white" /> 
        };
      default:
        return { 
          bg: "bg-slate-200", 
          border: "border-slate-200", 
          iconColor: "text-slate-500",
          textColor: "text-slate-400",
          subTextColor: "text-slate-300",
          icon: <AlertCircle size={20} /> 
        };
    }
  };

  const colors = getColors();

  return (
    <div className="flex flex-col items-center gap-6 group relative">
      {/* Edge-to-Edge Handles: With 12px Gaping for better visibility */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ left: '-12px', top: '32px', transform: 'translateX(-100%)', opacity: 0, width: '4px', height: '4px' }} 
      />
      
      {/* Milestone Node */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.15 }}
        className={`
          w-16 h-16 rounded-full shadow-lg flex items-center justify-center 
          transition-all duration-500 relative z-10
          ${state === 'completed' ? 'shadow-emerald-100/50' : 'shadow-slate-100/30'}
          ${colors.bg} ${colors.border}
        `}
      >
        {/* Main Icon */}
        {CustomIcon ? <CustomIcon size={24} className="text-white" /> : colors.icon}

        {/* Heartbeat pulse for active node */}
        {isHeartbeat && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="absolute inset-0 rounded-full bg-indigo-500 -z-10"
          />
        )}
      </motion.div>
      
      {/* Labels below the node */}
      <div className="flex flex-col items-center text-center max-w-[150px] gap-1 px-2">
        <span className={`text-[12px] font-black tracking-tight ${colors.textColor} leading-[1.2]`}>
          {label}
        </span>
        {timestamp && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            {timestamp}
          </span>
        )}
        {reason && (
          <span className={`text-[9.5px] font-bold italic px-2 py-0.5 mt-1 rounded-full bg-slate-50 border border-slate-100 ${colors.subTextColor}`}>
            {reason}
          </span>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ right: '-12px', top: '32px', transform: 'translateX(100%)', opacity: 0, width: '4px', height: '4px' }} 
      />
    </div>
  );
};

interface OrderProgressFlowProps {
  order: any;
  className?: string;
}

/**
 * Milestone Tracker Component (Image 2 Aesthetic)
 */
const OrderProgressFlow: React.FC<OrderProgressFlowProps> = ({ order, className }) => {
  const [ref, { width }] = useMeasure();
  const nodeTypes = useMemo(() => ({ orderStep: OrderStepNode }), []);

  const { nodes, edges } = useMemo(() => {
    // Dynamically map order to graph based on container width (Responsive Snake Layout)
    return mapOrderToGraph(order, width > 0 ? width : 1200);
  }, [order, width]);

  return (
    <div ref={ref as any} className={`w-full h-[550px] bg-white rounded-[40px] border-none overflow-hidden relative ${className}`}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
              padding: 0.2, 
              minZoom: 0.1,
              maxZoom: 1.0
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          preventScrolling={false}
          defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { strokeWidth: 6, stroke: '#e2e8f0' },
          }}
        >
          <Background 
              variant={BackgroundVariant.Dots} 
              gap={40} 
              size={1} 
              color="#f1f5f9" 
              className="opacity-40"
          />
          <FlowAutoFitter nodes={nodes} />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Aesthetic Overlays */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-50/10 to-transparent" />
      
      {/* Legend */}
      <div className="absolute top-8 right-8 flex gap-4 bg-white/60 backdrop-blur-lg px-6 py-2.5 rounded-2xl border border-white/50 shadow-sm pointer-events-none">
        <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Completed</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">In Progress</span>
        </div>
      </div>
    </div>
  );
};

export default OrderProgressFlow;
