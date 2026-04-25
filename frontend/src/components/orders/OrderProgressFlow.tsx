import React, { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { mapOrderToGraph } from "@/uiAdapters/orderFlowMapper";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";

const NODE_WIDTH = 150;
const NODE_CIRCLE_SIZE = 64;
const NODE_RADIUS = NODE_CIRCLE_SIZE / 2;
const GRAPH_PADDING_X = 48;
const GRAPH_PADDING_Y = 48;
const GRAPH_MIN_WIDTH = 350;
const GRAPH_MAX_HEIGHT = 430;

type RoadmapState = "completed" | "active" | "upcoming" | "terminated" | "warning";

type FlowNode = {
  id: string;
  data: {
    label: string;
    state: RoadmapState;
    reason?: string | null;
    isHeartbeat?: boolean;
    icon?: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    timestamp?: string;
    byline?: string;
  };
  position: { x: number; y: number };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: { stroke?: string; strokeWidth?: number; opacity?: number };
};

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

const OrderStepNode = ({ data, isCurrent }: { data: FlowNode["data"], isCurrent?: boolean }) => {
  const { t } = useTranslation();
  const { label, state, isHeartbeat, reason, icon: CustomIcon, timestamp, byline } = data;

  const colors = (() => {
    const iconSize = 28;
    const strokeWidth = 2.5;

    switch (state) {
      case "completed":
        return {
          bg: "bg-[#2B8441]",
          textColor: "text-slate-900",
          subTextColor: "text-slate-400",
          shadow: "shadow-emerald-900/10",
          icon: CustomIcon ? <CustomIcon size={iconSize} className="text-white" strokeWidth={strokeWidth} /> : <CheckCircle2 size={iconSize} className="text-white" strokeWidth={strokeWidth} />,
        };
      case "active":
        return {
          bg: "bg-[#2B8441]",
          textColor: "text-[#2B8441]",
          subTextColor: "text-emerald-400",
          shadow: "shadow-emerald-700/20",
          icon: CustomIcon ? <CustomIcon size={iconSize} className="text-white" strokeWidth={strokeWidth} /> : <Clock size={iconSize} className="text-white" strokeWidth={strokeWidth} />,
        };
      case "terminated":
        return {
          bg: "bg-rose-500",
          textColor: "text-rose-600",
          subTextColor: "text-rose-400",
          shadow: "shadow-rose-500/20",
          icon: CustomIcon ? <CustomIcon size={iconSize} className="text-white" strokeWidth={strokeWidth} /> : <XCircle size={iconSize} className="text-white" strokeWidth={strokeWidth} />,
        };
      case "warning":
        return {
          bg: "bg-amber-500",
          textColor: "text-amber-600",
          subTextColor: "text-amber-400",
          shadow: "shadow-amber-500/20",
          icon: CustomIcon ? <CustomIcon size={iconSize} className="text-white" strokeWidth={strokeWidth} /> : <AlertCircle size={iconSize} className="text-white" strokeWidth={strokeWidth} />,
        };
      default:
        return {
          bg: "bg-[#E5DDD1]",
          textColor: "text-slate-400",
          subTextColor: "text-slate-300",
          shadow: "shadow-slate-100/10",
          icon: CustomIcon ? <CustomIcon size={24} className="text-slate-500/50" /> : <Clock size={24} className="text-white/40" />,
        };
    }
  })();

  return (
    <div className="flex w-[150px] flex-col items-center gap-4 text-center relative">
      <div
        className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-xl transition-all duration-500 hover:scale-110 border-4 border-white
            ${colors.bg} ${colors.shadow} ${isCurrent ? 'ring-8 ring-emerald-50' : ''}
        `}
      >
        {colors.icon}
        {isHeartbeat && (
          <div className="absolute inset-0 -z-10 rounded-full bg-[#2B8441]/20 animate-ping" />
        )}
      </div>

      <div className="flex max-w-[150px] flex-col items-center gap-1.5">
        <span className={`text-[14px] font-black leading-tight tracking-tight ${colors.textColor}`}>
          {label}
        </span>
        {byline && (
          <span className="text-[10px] font-bold text-slate-400/80 leading-none mt-0.5">
            {byline}
          </span>
        )}
        {timestamp && (
          <span className="text-[11px] font-bold text-slate-400 tracking-wide mt-1">
            {timestamp}
          </span>
        )}
        {reason && (
          <span className={`text-[10px] font-bold italic px-3 py-1 mt-0.5 rounded-full bg-white/50 backdrop-blur-sm border border-slate-100 ${colors.subTextColor} leading-snug line-clamp-2 text-center shadow-sm`}>
            {t(reason)}
          </span>
        )}
      </div>
    </div>
  );
};

function buildEdgePath(source: FlowNode, target: FlowNode) {
    const sourceCenterX = source.position.x + NODE_WIDTH / 2 + GRAPH_PADDING_X;
    const sourceCenterY = source.position.y + NODE_RADIUS;
    const targetCenterX = target.position.x + NODE_WIDTH / 2 + GRAPH_PADDING_X;
    const targetCenterY = target.position.y + NODE_RADIUS;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    // Same row curve
    if (Math.abs(dy) < 50) {
        const isLR = dx > 0;
        const startX = isLR ? sourceCenterX + NODE_RADIUS : sourceCenterX - NODE_RADIUS;
        const endX = isLR ? targetCenterX - NODE_RADIUS : targetCenterX + NODE_RADIUS;
        const cp = (endX - startX) * 0.4;
        return `M ${startX} ${sourceCenterY} C ${startX + cp} ${sourceCenterY}, ${endX - cp} ${targetCenterY}, ${endX} ${targetCenterY}`;
    }

    // Wrap curve
    const startY = dy > 0 ? sourceCenterY + NODE_RADIUS : sourceCenterY - NODE_RADIUS;
    const endY = dy > 0 ? targetCenterY - NODE_RADIUS : targetCenterY + NODE_RADIUS;
    const cpY = (endY - startY) * 0.5;
    return `M ${sourceCenterX} ${startY} C ${sourceCenterX} ${startY + cpY}, ${targetCenterX} ${endY - cpY}, ${targetCenterX} ${endY}`;
}

interface OrderProgressFlowProps {
  order: any;
  className?: string;
}

const OrderProgressFlow: React.FC<OrderProgressFlowProps> = ({ order, className }) => {
  const [ref, { width }] = useMeasure();

  const { nodes, edges, canvasWidth, canvasHeight, scale } = useMemo(() => {
    const availableWidth = Math.max(width || 0, GRAPH_MIN_WIDTH);
    const graph = mapOrderToGraph(order, availableWidth);
    const typedNodes = (graph.nodes || []) as FlowNode[];
    const typedEdges = (graph.edges || []) as FlowEdge[];

    const furthestNodeX = typedNodes.reduce(
      (max, node) => Math.max(max, node.position.x + NODE_WIDTH),
      0
    );
    const furthestNodeY = typedNodes.reduce(
      (max, node) => Math.max(max, node.position.y + 190),
      0
    );

    const rawCanvasWidth = furthestNodeX + (GRAPH_PADDING_X * 2);
    const rawCanvasHeight = Math.max(furthestNodeY + GRAPH_PADDING_Y, 280);
    const nextScale = Math.min(
      1,
      (availableWidth - 100) / rawCanvasWidth
    );

    return {
      nodes: typedNodes,
      edges: typedEdges,
      canvasWidth: rawCanvasWidth,
      canvasHeight: rawCanvasHeight + 20, 
      scale: Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1,
    };
  }, [order, width]);

  const scaledHeight = canvasHeight * scale;
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  return (
    <div
      ref={ref}
      className={`relative min-h-[300px] w-full overflow-x-auto rounded-[40px] border border-slate-100 bg-white/40 shadow-xl shadow-slate-200/20 backdrop-blur-md scrollbar-hide ${className}`}
    >
        <div className="absolute top-6 right-8 flex flex-wrap justify-end gap-x-6 gap-y-2 z-20">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#2B8441] shadow-sm" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#2B8441] shadow-sm animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warning</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terminated</span>
            </div>
        </div>

      <div 
        className={`flex flex-col items-center px-16 pb-12 pt-24 transition-all duration-500 ${
          scaledHeight < 200 ? "justify-center min-h-[300px]" : "justify-start"
        }`}
      >
        <div
          className="relative origin-top transition-transform duration-500 ease-out"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${scale})`,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            fill="none"
            aria-hidden="true"
          >
            {edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);

              if (!source || !target) return null;

              return (
                <path
                  key={edge.id}
                  d={buildEdgePath(source, target)}
                  stroke={edge.style?.stroke === "#e2e8f0" ? "#cbd5e1" : "#059669"}
                  strokeWidth={4}
                  strokeOpacity={0.6}
                  strokeLinecap="round"
                  strokeDasharray="12 12"
                />
              );
            })}
          </svg>

          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: `${node.position.x + GRAPH_PADDING_X}px`,
                top: `${node.position.y}px`,
                width: `${NODE_WIDTH}px`,
              }}
            >
              <OrderStepNode data={node.data} isCurrent={node.data.state === 'active'} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderProgressFlow;
