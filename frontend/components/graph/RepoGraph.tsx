'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Node {
  id: string;
  name: string;
  group: string;
  val: number;
  color: string;
  language?: string;
  stars?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: string;
}

interface RepoGraphProps {
  highlightedNodeIds: string[];
}

const RepoGraph: React.FC<RepoGraphProps> = ({ highlightedNodeIds }) => {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  // Responsive window tracking
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fetch full graph map centrally
  useEffect(() => {
    fetch('/api/py/graph-full')
      .then(res => res.json())
      .then(data => {
        setGraphData(data);
        requestAnimationFrame(() => {
          fgRef.current?.zoomToFit(1200, 80);
          fgRef.current?.centerAt(0, 0, 1200);
        });
      })
      .catch(err => console.error("Could not load initial graph:", err));
  }, []);

  // Animate Camera to fit highlighted clusters via the ForceGraph ref!
  useEffect(() => {
    if (highlightedNodeIds.length > 0 && fgRef.current) {
        // Collect coordinates of highlighted nodes representing our repo cluster
        const matchedNodes = graphData.nodes.filter(n => highlightSet.has(n.id));
        if (matchedNodes.length > 0) {
           fgRef.current.zoomToFit(1000, 50, (node: Node) => highlightSet.has(node.id));
        }
    } else if (highlightedNodeIds.length === 0 && fgRef.current && graphData.nodes.length > 0) {
        // Reset zoom to match everything
        fgRef.current.zoomToFit(1000, 100);
    }
  }, [highlightedNodeIds, graphData.nodes, highlightSet]);


  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightedNodeIds.length === 0 || highlightSet.has(node.id);
    const radius = Math.min(Math.max(node.val || 3, 2), 10);
    
    // Draw basic circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHighlighted ? node.color : '#27272a'; // dim unhighlighted
    ctx.fill();

    if (isHighlighted && highlightedNodeIds.length > 0) {
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.75)';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
    }

    // Render name text when zoomed in enough or if heavily highlighted
    if (isHighlighted && globalScale >= 2 && node.group !== 'user') {
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fafafa';
        ctx.fillText(node.name, node.x, node.y + radius + (4/globalScale));
    }
  }, [highlightedNodeIds, highlightSet]);

  return (
    <div className="absolute inset-0 z-0 bg-transparent overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        width={windowSize.width}
        height={windowSize.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        linkVisibility={(link: any) => {
             // Only show link if source and target are highlighted
             if (highlightedNodeIds.length === 0) return true;
             return highlightSet.has(link.source.id) || highlightSet.has(link.target.id);
        }}
        linkColor={() => 'rgba(113, 113, 122, 0.2)'}
        linkWidth={0.5}
        cooldownTicks={120}
        onEngineStop={() => fgRef.current?.zoomToFit(600, 80)}
        d3VelocityDecay={0.3} // makes it floatly
      />
    </div>
  );
};

export default RepoGraph;
