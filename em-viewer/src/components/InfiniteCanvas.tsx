import { useState, useRef, useCallback, useEffect } from 'react';
import type { ViewportState } from '../types';

interface InfiniteCanvasProps {
  children: (viewport: ViewportState) => React.ReactNode;
  panRequest?: 'left' | 'right' | null;
  onPanHandled?: () => void;
}

const PAN_AMOUNT = 400;

export function InfiniteCanvas({ children, panRequest, onPanHandled }: InfiniteCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({ offsetX: 40, offsetY: 250, scale: 1 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!panRequest) return;
    setViewport(v => ({
      ...v,
      offsetX: panRequest === 'right' ? v.offsetX - PAN_AMOUNT : v.offsetX + PAN_AMOUNT,
    }));
    onPanHandled?.();
  }, [panRequest, onPanHandled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setViewport(v => ({
      ...v,
      offsetX: v.offsetX + (e.clientX - lastPos.current.x),
      offsetY: v.offsetY + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    setViewport(v => {
      const newScale = Math.max(0.2, Math.min(4, v.scale * factor));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...v, scale: newScale };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return {
        offsetX: mx - (mx - v.offsetX) * (newScale / v.scale),
        offsetY: my - (my - v.offsetY) * (newScale / v.scale),
        scale: newScale,
      };
    });
  }, []);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100vw', height: '100vh', display: 'block', cursor: dragging.current ? 'grabbing' : 'grab', background: '#0f0f1a' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <g transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.scale})`}>
        {children(viewport)}
      </g>
    </svg>
  );
}
