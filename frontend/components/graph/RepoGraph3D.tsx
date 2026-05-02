'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { fetchGraph, fetchPullRequestFlow } from '@/lib/api';
import {
  GraphData,
  GraphNode,
  GraphOptions,
  PullRequestFlowResponse,
  PullRequestFlowSummary,
} from '@/lib/types';

interface RepoGraph3DProps {
  highlightedNodeIds: string[];
  options: GraphOptions;
  onStatsChange: (stats: { projectCount: number; clusterCount: number }) => void;
  onClusterSelect: (clusterName: string | null) => void;
}

const languageColors: Record<string, string> = {
  TypeScript: '#38bdf8',
  JavaScript: '#facc15',
  Python: '#60a5fa',
  Rust: '#fb7185',
  Go: '#22d3ee',
  Java: '#f97316',
  Ruby: '#f472b6',
};

function repoIdFromNodeId(nodeId: string) {
  const match = /^repo_(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) : null;
}

function flowTotal(flow?: PullRequestFlowSummary) {
  if (!flow) return 0;
  return flow.openCount + flow.mergedCount + flow.closedCount;
}

function makeLabel(text: string, color = '#f8fafc') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 384;
  const height = 96;
  canvas.width = width;
  canvas.height = height;

  if (context) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(2, 6, 23, 0.78)';
    context.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    context.lineWidth = 2;
    context.roundRect(8, 8, width - 16, height - 16, 14);
    context.fill();
    context.stroke();
    context.font = '600 30px Inter, sans-serif';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.slice(0, 34), width / 2, height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(28, 7, 1);
  return sprite;
}

function createCityObject(node: GraphNode, flow?: PullRequestFlowSummary) {
  const group = new THREE.Group();
  const baseRadius = Math.max(7, Math.min(20, (node.val || 8) * 0.9));
  const baseHeight = 1.4;
  const towerHeight = Math.max(7, Math.min(36, 8 + Math.sqrt(node.stars || 0) / 80 + (node.repoCount || 0) * 0.6));
  const flowBoost = Math.min(8, flowTotal(flow) * 0.6);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius, baseRadius * 1.18, baseHeight, 36),
    new THREE.MeshStandardMaterial({
      color: '#111827',
      emissive: node.color,
      emissiveIntensity: 0.22,
      metalness: 0.45,
      roughness: 0.45,
    }),
  );
  base.position.y = baseHeight / 2;
  group.add(base);

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.28, baseRadius * 0.42, towerHeight + flowBoost, 8),
    new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: node.color,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.28,
    }),
  );
  tower.position.y = baseHeight + (towerHeight + flowBoost) / 2;
  group.add(tower);

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(baseRadius * 0.32, 4, 8),
    new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: node.color,
      emissiveIntensity: 0.7,
    }),
  );
  crown.position.y = baseHeight + towerHeight + flowBoost + 2;
  group.add(crown);

  const label = makeLabel(node.name, '#f8fafc');
  label.position.y = baseHeight + towerHeight + flowBoost + 9;
  group.add(label);

  return group;
}

function createRepoObject(node: GraphNode, flow?: PullRequestFlowSummary, dimmed = false) {
  const group = new THREE.Group();
  const color = dimmed ? '#3f3f46' : languageColors[node.language || ''] || node.color || '#8b5cf6';
  const height = Math.max(2.5, Math.min(18, 3 + Math.sqrt(node.stars || 0) / 95 + flowTotal(flow) * 0.35));
  const width = Math.max(1.5, Math.min(4.8, node.val || 2.5));

  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: dimmed ? 0.08 : 0.35,
      metalness: 0.3,
      roughness: 0.36,
    }),
  );
  building.position.y = height / 2;
  group.add(building);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.6, width * 0.25), 12, 12),
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: color,
      emissiveIntensity: dimmed ? 0.1 : 0.8,
    }),
  );
  beacon.position.y = height + 0.9;
  group.add(beacon);

  return group;
}

const RepoGraph3D: React.FC<RepoGraph3DProps> = ({
  highlightedNodeIds,
  options,
  onStatsChange,
  onClusterSelect,
}) => {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [flowData, setFlowData] = useState<PullRequestFlowResponse | null>(null);
  const [flowStatus, setFlowStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'unavailable'>('idle');
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  useEffect(() => {
    const updateSize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchGraph(options)
      .then((data) => {
        if (!isMounted) return;
        setGraphData(data);
        onStatsChange({
          projectCount: data.meta?.projectCount || 0,
          clusterCount: data.meta?.clusterCount || 0,
        });
        onClusterSelect(null);
        requestAnimationFrame(() => fgRef.current?.zoomToFit(1200, 100));
      })
      .catch((err) => console.error('Could not load 3D graph:', err));

    return () => {
      isMounted = false;
    };
  }, [options, onClusterSelect, onStatsChange]);

  useEffect(() => {
    const repoIds = graphData.nodes
      .filter((node) => node.nodeType === 'repository')
      .filter((node) => highlightedNodeIds.length === 0 || highlightSet.has(node.id))
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      .map((node) => repoIdFromNodeId(node.id))
      .filter((id): id is number => typeof id === 'number')
      .slice(0, 24);

    if (repoIds.length === 0) {
      setFlowData(null);
      setFlowStatus('empty');
      return;
    }

    let isMounted = true;
    setFlowStatus('loading');
    fetchPullRequestFlow(repoIds, 30)
      .then((data) => {
        if (!isMounted) return;
        setFlowData(data);
        setFlowStatus('ready');
      })
      .catch((error) => {
        console.error('[PR flow] Error:', error);
        if (isMounted) {
          setFlowData(null);
          setFlowStatus('unavailable');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [graphData.nodes, highlightedNodeIds.length, highlightSet]);

  const augmentedGraphData = useMemo(() => {
    if (!flowData) return graphData;

    const prLinks = graphData.links.flatMap((link: any) => {
      if (!String(link.type || '').startsWith('grouped_by')) return [];
      const source = typeof link.source === 'string' ? link.source : link.source?.id;
      const target = typeof link.target === 'string' ? link.target : link.target?.id;
      const repoId = repoIdFromNodeId(target);
      const flow = repoId ? flowData.summaries[String(repoId)] : null;
      if (!source || !target || !flow || !flow.available || flowTotal(flow) === 0) return [];
      return [
        { source: target, target: source, type: 'pr_flow_open', value: flow.openCount },
        { source: target, target: source, type: 'pr_flow_merged', value: flow.mergedCount },
        { source: target, target: source, type: 'pr_flow_closed', value: flow.closedCount },
      ].filter((item) => item.value > 0);
    });

    return {
      ...graphData,
      links: [...graphData.links, ...prLinks],
    };
  }, [flowData, graphData]);

  const nodeObject = useCallback((node: GraphNode) => {
    const repoId = repoIdFromNodeId(node.id);
    const flow = repoId ? flowData?.summaries[String(repoId)] : undefined;
    const isDimmed = highlightedNodeIds.length > 0 && !highlightSet.has(node.id);

    if (node.nodeType === 'cluster') {
      return createCityObject(node);
    }

    if (node.nodeType === 'repository') {
      return createRepoObject(node, flow, isDimmed);
    }

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(node.nodeType === 'topic' ? 1.6 : 1.1, 12, 12),
      new THREE.MeshStandardMaterial({
        color: isDimmed ? '#3f3f46' : node.color || '#64748b',
        emissive: isDimmed ? '#18181b' : node.color || '#64748b',
        emissiveIntensity: 0.25,
      }),
    );
    return marker;
  }, [flowData, highlightSet, highlightedNodeIds.length]);

  const nodeLabel = useCallback((node: GraphNode) => {
    const repoId = repoIdFromNodeId(node.id);
    const flow = repoId ? flowData?.summaries[String(repoId)] : undefined;
    const prLine = flow
      ? `<div>PRs: ${flow.openCount} open · ${flow.mergedCount} merged · ${flow.closedCount} closed</div>`
      : '';
    const repoLine = node.nodeType === 'cluster'
      ? `<div>${node.repoCount || 0} repositories · ${node.stars || 0} stars</div>`
      : `<div>${node.language || 'Unknown'} · ${node.stars || 0} stars · ${node.openIssues || 0} issues</div>`;

    return `
      <div style="padding:8px 10px;border-radius:8px;background:rgba(2,6,23,.88);border:1px solid rgba(148,163,184,.35);color:#f8fafc;font:12px Inter,sans-serif;max-width:260px">
        <div style="font-weight:700;margin-bottom:4px">${node.name}</div>
        ${repoLine}
        ${prLine}
      </div>
    `;
  }, [flowData]);

  const handleNodeClick = useCallback((node: any) => {
    if (node.nodeType === 'cluster') {
      onClusterSelect(node.name);
      fgRef.current?.cameraPosition(
        { x: (node.x || 0) * 1.45, y: (node.y || 0) * 1.45 + 55, z: (node.z || 0) * 1.45 + 120 },
        node,
        1000,
      );
    } else if (node.url) {
      window.open(node.url, '_blank', 'noopener,noreferrer');
    }
  }, [onClusterSelect]);

  const flowMessage = useMemo(() => {
    if (flowData && flowStatus === 'ready') {
      return `${flowData.aggregate.openCount} open · ${flowData.aggregate.mergedCount} merged · ${flowData.aggregate.closedCount} closed PRs`;
    }
    if (flowStatus === 'empty') return 'PR flow appears when repositories are loaded';
    if (flowStatus === 'unavailable') return 'PR flow unavailable from GitHub';
    return 'PR flow loading live GitHub data';
  }, [flowData, flowStatus]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
        {flowMessage}
      </div>
      <ForceGraph3D
        ref={fgRef}
        width={windowSize.width}
        height={windowSize.height}
        graphData={augmentedGraphData}
        backgroundColor="#020617"
        nodeThreeObject={nodeObject}
        nodeLabel={nodeLabel}
        onNodeClick={handleNodeClick}
        linkColor={(link: any) => {
          if (link.type === 'pr_flow_open') return 'rgba(34, 211, 238, 0.85)';
          if (link.type === 'pr_flow_merged') return 'rgba(168, 85, 247, 0.9)';
          if (link.type === 'pr_flow_closed') return 'rgba(148, 163, 184, 0.5)';
          return String(link.type || '').startsWith('grouped_by')
            ? 'rgba(20, 184, 166, 0.22)'
            : 'rgba(100, 116, 139, 0.16)';
        }}
        linkWidth={(link: any) => String(link.type || '').startsWith('pr_flow') ? Math.max(0.7, Math.min(3.5, link.value * 0.35)) : 0.45}
        linkOpacity={0.72}
        linkDirectionalParticles={(link: any) => String(link.type || '').startsWith('pr_flow') ? Math.min(8, Math.max(1, link.value)) : 0}
        linkDirectionalParticleSpeed={(link: any) => link.type === 'pr_flow_merged' ? 0.012 : 0.008}
        linkDirectionalParticleWidth={(link: any) => String(link.type || '').startsWith('pr_flow') ? 2.4 : 0}
        cooldownTicks={140}
        d3VelocityDecay={0.34}
        onEngineStop={() => fgRef.current?.zoomToFit(900, 120)}
      />
    </div>
  );
};

export default RepoGraph3D;
