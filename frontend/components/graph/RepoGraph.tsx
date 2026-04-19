'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchGraph } from '@/lib/api';
import { GraphData, GraphNode, GraphOptions } from '@/lib/types';

interface RepoGraphProps {
  highlightedNodeIds: string[];
  options: GraphOptions;
  onStatsChange: (stats: { projectCount: number; clusterCount: number }) => void;
  onClusterSelect: (clusterName: string | null) => void;
}

const RepoGraph: React.FC<RepoGraphProps> = ({
  highlightedNodeIds,
  options,
  onStatsChange,
  onClusterSelect,
}) => {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
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
    let isMounted = true;

    fetchGraph(options)
      .then(data => {
        if (!isMounted) return;
        setGraphData(data);
        onStatsChange({
          projectCount: data.meta?.projectCount || 0,
          clusterCount: data.meta?.clusterCount || 0,
        });
        onClusterSelect(null);
        requestAnimationFrame(() => {
          fgRef.current?.zoomToFit(1200, 80);
        });
      })
      .catch(err => console.error("Could not load initial graph:", err));

    return () => {
      isMounted = false;
    };
  }, [options, onClusterSelect, onStatsChange]);

  // Animate Camera to fit highlighted clusters via the ForceGraph ref!
  useEffect(() => {
    if (highlightedNodeIds.length > 0 && fgRef.current) {
        // Collect coordinates of highlighted nodes representing our repo cluster
        const matchedNodes = graphData.nodes.filter(n => highlightSet.has(n.id));
        if (matchedNodes.length > 0) {
           fgRef.current.zoomToFit(1000, 50, (node: GraphNode) => highlightSet.has(node.id));
        }
    } else if (highlightedNodeIds.length === 0 && fgRef.current && graphData.nodes.length > 0) {
        // Reset zoom to match everything
        fgRef.current.zoomToFit(1000, 100);
    }
  }, [highlightedNodeIds, graphData.nodes, highlightSet]);


  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightedNodeIds.length === 0 || highlightSet.has(node.id);
    const isCluster = node.nodeType === 'cluster';
    const radius = Math.min(Math.max(node.val || 3, isCluster ? 8 : 2), isCluster ? 30 : 10);
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHighlighted ? node.color : '#27272a'; // dim unhighlighted
    ctx.fill();

    if (isCluster) {
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.55)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
    } else if (isHighlighted && highlightedNodeIds.length > 0) {
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.75)';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
    }

    const shouldLabel = isCluster || (isHighlighted && globalScale >= 1.8 && node.group !== 'user');
    if (shouldLabel) {
        const fontSize = (isCluster ? 13 : 11) / globalScale;
        ctx.font = `${isCluster ? 700 : 500} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fafafa';
        ctx.fillText(node.name, node.x, node.y + radius + (isCluster ? 9 : 5) / globalScale);

        if (isCluster && node.repoCount) {
          ctx.font = `${10 / globalScale}px Inter, sans-serif`;
          ctx.fillStyle = '#a1a1aa';
          ctx.fillText(`${node.repoCount} repos`, node.x, node.y + radius + (23 / globalScale));
        }
    }
  }, [highlightedNodeIds, highlightSet]);

  const handleNodeClick = useCallback((node: any) => {
    if (node.nodeType === 'cluster') {
      onClusterSelect(node.name);
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        fgRef.current?.centerAt(node.x, node.y, 800);
        fgRef.current?.zoom(2.3, 800);
      }
    } else if (node.url) {
      window.open(node.url, '_blank', 'noopener,noreferrer');
    }
  }, [onClusterSelect]);

  return (
    <div className="absolute inset-0 z-0 bg-transparent overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        width={windowSize.width}
        height={windowSize.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeClick={handleNodeClick}
        linkVisibility={(link: any) => {
             // Only show link if source and target are highlighted
             if (highlightedNodeIds.length === 0) return true;
             return highlightSet.has(link.source.id) || highlightSet.has(link.target.id);
        }}
        linkColor={(link: any) => link.type?.startsWith('grouped_by') ? 'rgba(20, 184, 166, 0.22)' : 'rgba(113, 113, 122, 0.16)'}
        linkWidth={(link: any) => link.type?.startsWith('grouped_by') ? 0.8 : 0.35}
        cooldownTicks={120}
        onEngineStop={() => fgRef.current?.zoomToFit(600, 80)}
        d3VelocityDecay={0.3} // makes it floatly
      />
    </div>
  );
};

export default RepoGraph;
