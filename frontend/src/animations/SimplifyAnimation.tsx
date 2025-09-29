import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import "../styles/simplify-animation.css";

export type Edge = { from: string; to: string; amount: number };
export type AnimationNode = { id: string; label: string };

type Props = {
  nodes: AnimationNode[];
  rawEdges: Edge[];
  simplifiedEdges: Edge[];
  width?: number;
  height?: number;
  cycleMs?: number; // full cycle duration
  autoplay?: boolean;
  currency?: string;
  onClose?: () => void; // Callback for close button
};

type LayoutNode = { x: number; y: number; width?: number; height?: number };

type Phase = 0 | 1 | 2; // 0=raw, 1=crossfade, 2=simplified

export default function SimplifyAnimationFM({
  nodes,
  rawEdges,
  simplifiedEdges,
  width = 720,
  height = 320,
  cycleMs = 2600,
  autoplay = true,
  currency,
  onClose,
}: Props) {
  const MIN_NODE_WIDTH = 48;
  const LABEL_HEIGHT = 28;
  const PADDING_X = 16;
  const PADDING_Y = 16;

  const nodeDimensions = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((n) => {
          const widthEstimate = Math.max(MIN_NODE_WIDTH, n.label.length * 9 + 12);
          return [n.id, { width: widthEstimate, height: LABEL_HEIGHT }];
        })
      ),
    [nodes]
  );

  const maxNodeSize = useMemo(() => {
    let maxWidth = MIN_NODE_WIDTH;
    let maxHeight = LABEL_HEIGHT;
    nodes.forEach((node) => {
      const dims = nodeDimensions[node.id];
      if (dims) {
        maxWidth = Math.max(maxWidth, dims.width);
        maxHeight = Math.max(maxHeight, dims.height);
      }
    });
    return { maxWidth, maxHeight };
  }, [nodes, nodeDimensions]);

  // simple circular layout
  const layout = useMemo(() => {
    if (nodes.length === 0) {
      return {
        positions: {} as Record<string, { x: number; y: number }>,
      };
    }

    const cx = width / 2;
    const cy = height / 2;
    const radiusX = Math.max((width - 2 * PADDING_X - maxNodeSize.maxWidth) / 2, 0);
    const radiusY = Math.max((height - 2 * PADDING_Y - maxNodeSize.maxHeight) / 2, 0);

    if (nodes.length === 1) {
      return {
        positions: {
          [nodes[0].id]: { x: cx, y: cy },
        },
      };
    }

    const base = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + radiusX * Math.cos(angle);
      const y = cy + radiusY * Math.sin(angle);
      return { id: n.id, x, y };
    });

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    base.forEach(({ id, x, y }) => {
      const dims = nodeDimensions[id];
      const halfW = (dims?.width ?? 0) / 2;
      const halfH = (dims?.height ?? 0) / 2;
      minX = Math.min(minX, x - halfW);
      maxX = Math.max(maxX, x + halfW);
      minY = Math.min(minY, y - halfH);
      maxY = Math.max(maxY, y + halfH);
    });

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const availableWidth = Math.max(width - PADDING_X * 2, 1);
    const availableHeight = Math.max(height - PADDING_Y * 2, 1);
    const scaleX = spanX > 0 ? availableWidth / spanX : 1;
    const scaleY = spanY > 0 ? availableHeight / spanY : 1;

    const bboxCx = (minX + maxX) / 2;
    const bboxCy = (minY + maxY) / 2;

    const positions = Object.fromEntries(
      base.map(({ id, x, y }) => [
        id,
        {
          x: cx + (x - bboxCx) * scaleX,
          y: cy + (y - bboxCy) * scaleY,
        },
      ])
    );

    return { positions };
  }, [nodes, width, height, nodeDimensions, maxNodeSize]);

  const [phase, setPhase] = useState<Phase>(0);
  const playing = useRef<boolean>(autoplay);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [cycleCount, setCycleCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const scaledNodeDimensions = useMemo(() => {
    return Object.fromEntries(
      nodes.map((n) => {
        const dims = nodeDimensions[n.id] ?? {
          width: Math.max(MIN_NODE_WIDTH, LABEL_HEIGHT),
          height: LABEL_HEIGHT,
        };
        return [n.id, { width: dims.width, height: dims.height }];
      })
    );
  }, [nodes, nodeDimensions]);

  const fallbackDims = useMemo(
    () => ({
      width: Math.max(MIN_NODE_WIDTH, LABEL_HEIGHT),
      height: LABEL_HEIGHT,
    }),
    []
  );

  useEffect(() => {
    if (!playing.current || !isPlaying) return;
    const rawTime = cycleMs * 0.45;
    const xfadeTime = cycleMs * 0.15;
    const simpTime = cycleMs * 0.4;

    let mounted = true;

    async function loop() {
      if (!mounted) return;
      
      // First cycle: Red -> Green
      setPhase(0);
      await sleep(rawTime);
      if (!mounted || !playing.current || !isPlaying) return;

      setPhase(1);
      await sleep(xfadeTime);
      if (!mounted || !playing.current || !isPlaying) return;

      setPhase(2);
      await sleep(simpTime);
      if (!mounted || !playing.current || !isPlaying) return;

      // Increment cycle count
      setCycleCount(prev => {
        const newCount = prev + 1;
        return newCount;
      });

      // If we've completed 2 cycles, pause on green (phase 2)
      if (cycleCount + 1 >= 2) {
        setIsPlaying(false);
        playing.current = false;
        return; // End here on green arrows
      }

      // Second cycle: Red -> Green
      if (isPlaying && playing.current) {
        setPhase(0);
        await sleep(rawTime);
        if (!mounted || !playing.current || !isPlaying) return;

        setPhase(1);
        await sleep(xfadeTime);
        if (!mounted || !playing.current || !isPlaying) return;

        setPhase(2);
        await sleep(simpTime);
        if (!mounted || !playing.current || !isPlaying) return;

        // After second cycle, pause on green
        setIsPlaying(false);
        playing.current = false;
      }
    }

    loop();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleMs, isPlaying]);

  const rawOpacity = phase === 0 ? 1 : phase === 1 ? 0.4 : 0;
  const simpOpacity = phase === 0 ? 0 : phase === 1 ? 0.6 : 1;

  const handlePlayPause = () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    playing.current = newPlaying;
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="sa-wrap" style={{ position: 'relative' }}>
      {/* Control buttons */}
      <div style={{ 
        position: 'absolute', 
        top: '0px', 
        left: '8px', 
        right: '8px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9CA3AF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            pointerEvents: 'auto',
            padding: '4px'
          }}
          title="Close animation"
        >
          ×
        </button>

        {/* Play/Pause button */}
        <button
          onClick={handlePlayPause}
          style={{
            background: 'none',
            border: 'none',
            color: '#9CA3AF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            pointerEvents: 'auto',
            padding: '4px'
          }}
          title={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <svg className="sa-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* raw edges */}
        <motion.g animate={{ opacity: rawOpacity }} transition={{ duration: 0.35 }}>
          {rawEdges.map((edge, i) => {
            const a = layout.positions[edge.from];
            const b = layout.positions[edge.to];
            if (!a || !b) return null;
            const aDims = scaledNodeDimensions[edge.from] ?? fallbackDims;
            const bDims = scaledNodeDimensions[edge.to] ?? fallbackDims;
            return (
              <AnimatedArrow
                key={`r-${i}`}
                a={{ ...a, ...aDims }}
                b={{ ...b, ...bDims }}
                color="#DC2626"
                thin
                drawDelay={i * 0.06}
                width={width}
                height={height}
              />
            );
          })}
        </motion.g>

        {/* simplified edges */}
        <motion.g animate={{ opacity: simpOpacity }} transition={{ duration: 0.35 }}>
          {simplifiedEdges.map((edge, i) => {
            const a = layout.positions[edge.from];
            const b = layout.positions[edge.to];
            if (!a || !b) return null;
            const aDims = scaledNodeDimensions[edge.from] ?? fallbackDims;
            const bDims = scaledNodeDimensions[edge.to] ?? fallbackDims;
            return (
              <AnimatedArrow
                key={`s-${i}`}
                a={{ ...a, ...aDims }}
                b={{ ...b, ...bDims }}
                color="#16A34A"
                thin={false}
                drawDelay={i * 0.08}
                width={width}
                height={height}
              />
            );
          })}
        </motion.g>

        {/* nodes */}
        {nodes.map((n) => {
          const pos = layout.positions[n.id];
          if (!pos) return null;
          const dims = scaledNodeDimensions[n.id] ?? fallbackDims;
          const labelWidth = dims.width;
          const labelHeight = dims.height;
          return (
            <g key={n.id} transform={`translate(${pos.x},${pos.y})`}>
              <motion.foreignObject
                x={-labelWidth / 2}
                y={-labelHeight / 2}
                width={labelWidth}
                height={labelHeight}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <div className="sa-node-pill">{n.label}</div>
              </motion.foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AnimatedArrow({
  a,
  b,
  color,
  thin,
  drawDelay = 0,
  width = 720,
  height = 320,
}: {
  a: LayoutNode;
  b: LayoutNode;
  color: string;
  thin?: boolean;
  drawDelay?: number;
  width?: number;
  height?: number;
}) {
  const { start, end } = trimEndpoints(a, b);

  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const nx = -dy;
  const ny = dx;
  const k = 0.18;
  
  // Calculate control point with bounds checking
  let cx = mx + nx * k;
  let cy = my + ny * k;
  
  // Constrain control point to stay within SVG bounds with padding
  const padding = 20;
  const minX = padding;
  const maxX = width - padding;
  const minY = padding;
  const maxY = height - padding;
  
  cx = Math.max(minX, Math.min(maxX, cx));
  cy = Math.max(minY, Math.min(maxY, cy));

  const d = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  const strokeWidth = thin ? 2 : 4;
  const markerId = `m-${strokeWidth}-${color.replace("#", "")}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      <motion.path
        d={d}
        stroke={color}
        fill="none"
        strokeWidth={strokeWidth}
        markerEnd={`url(#${markerId})`}
        className="sa-edge"
        initial={{ pathLength: 0, opacity: 0.6 }}
        animate={{ pathLength: 1, opacity: 0.95 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: drawDelay }}
      />

      {/* amount pill removed per request */}
    </>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimEndpoints(a: LayoutNode, b: LayoutNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const aRadius = ellipseRadius(a.width, a.height, ux, uy);
  const bRadius = ellipseRadius(b.width, b.height, ux, uy);

  let startOffset = aRadius + 2;
  let endOffset = bRadius + 2;
  const totalOffset = startOffset + endOffset;

  if (len <= totalOffset) {
    const scale = len / (totalOffset || 1);
    startOffset *= scale;
    endOffset *= scale;
  }

  const start = {
    x: a.x + ux * startOffset,
    y: a.y + uy * startOffset,
  };

  const end = {
    x: b.x - ux * endOffset,
    y: b.y - uy * endOffset,
  };

  return { start, end };
}

function ellipseRadius(
  width = 56,
  height = 28,
  ux: number,
  uy: number
) {
  const rx = Math.max(width / 2, 1);
  const ry = Math.max(height / 2, 1);
  const denom = (ux * ux) / (rx * rx) + (uy * uy) / (ry * ry);
  if (denom === 0) {
    return Math.min(rx, ry);
  }
  return 1 / Math.sqrt(denom);
}
