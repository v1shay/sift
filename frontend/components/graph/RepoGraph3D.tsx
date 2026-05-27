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

const CITY_TEXTURE_SIZE = 512;
const CITY_TILE_WORLD_SIZE = 120;
const CITY_GRID_EXTENT = 5200;
const CITY_GROUND_Y = -5.2;
const CITY_TILE_REPEATS = CITY_GRID_EXTENT / CITY_TILE_WORLD_SIZE;

let cityTileTexture: THREE.CanvasTexture | null = null;
let glowTexture: THREE.CanvasTexture | null = null;

function repoIdFromNodeId(nodeId: string) {
  const match = /^repo_(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) : null;
}

function flowTotal(flow?: PullRequestFlowSummary) {
  if (!flow) return 0;
  return flow.openCount + flow.mergedCount + flow.closedCount;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createGlowTexture() {
  if (glowTexture) return glowTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.24, 'rgba(255,255,255,0.54)');
  gradient.addColorStop(0.56, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function drawTileRoad(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(4, 15, 24, 0.74)';
  context.lineWidth = width + 9;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();

  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();

  context.strokeStyle = 'rgba(191, 231, 255, 0.34)';
  context.lineWidth = Math.max(1, width * 0.1);
  context.setLineDash([20, 24]);
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.restore();
}

function createTileableCityTexture() {
  if (cityTileTexture) return cityTileTexture;

  const canvas = document.createElement('canvas');
  canvas.width = CITY_TEXTURE_SIZE;
  canvas.height = CITY_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const size = CITY_TEXTURE_SIZE;
  const ground = context.createLinearGradient(0, 0, size, size);
  ground.addColorStop(0, '#071725');
  ground.addColorStop(0.34, '#0c2a31');
  ground.addColorStop(0.68, '#132b27');
  ground.addColorStop(1, '#091319');
  context.fillStyle = ground;
  context.fillRect(0, 0, size, size);

  context.globalAlpha = 0.2;
  for (let i = 0; i < 120; i += 1) {
    const x = seededUnit(i + 9.2) * size;
    const y = seededUnit(i + 10.4) * size;
    const w = 14 + seededUnit(i + 11.8) * 58;
    const h = 8 + seededUnit(i + 12.7) * 42;
    context.fillStyle = i % 3 === 0 ? '#224642' : i % 3 === 1 ? '#163647' : '#273042';
    context.fillRect(x, y, w, h);
  }
  context.globalAlpha = 1;

  drawTileRoad(context, 0, size * 0.5, size, size * 0.5, 18, 'rgba(45, 149, 172, 0.54)');
  drawTileRoad(context, size * 0.5, 0, size * 0.5, size, 18, 'rgba(45, 149, 172, 0.54)');
  drawTileRoad(context, 0, 0, size, size, 11, 'rgba(89, 201, 167, 0.34)');
  drawTileRoad(context, size, 0, 0, size, 11, 'rgba(241, 198, 118, 0.26)');

  context.globalAlpha = 0.32;
  context.strokeStyle = 'rgba(190, 224, 232, 0.18)';
  context.lineWidth = 1;
  for (let step = 64; step < size; step += 64) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }

  context.globalAlpha = 0.46;
  for (let i = 0; i < 18; i += 1) {
    const cell = 64;
    const x = Math.floor(seededUnit(i + 30.1) * 6 + 1) * cell + 12;
    const y = Math.floor(seededUnit(i + 31.4) * 6 + 1) * cell + 10;
    const w = 16 + seededUnit(i + 32.2) * 22;
    const h = 12 + seededUnit(i + 33.3) * 24;
    context.fillStyle = ['#2c5960', '#264b39', '#334155', '#1f6f78'][i % 4];
    context.fillRect(x, y, w, h);
    context.fillStyle = 'rgba(190, 242, 255, 0.2)';
    context.fillRect(x + 3, y + 3, Math.max(4, w - 6), 2);
  }

  context.globalAlpha = 0.5;
  const glowPoints = [
    [size * 0.5, size * 0.5, 96, 'rgba(34, 211, 238, 0.18)'],
    [0, size * 0.5, 80, 'rgba(45, 212, 191, 0.12)'],
    [size, size * 0.5, 80, 'rgba(45, 212, 191, 0.12)'],
    [size * 0.5, 0, 80, 'rgba(125, 211, 252, 0.12)'],
    [size * 0.5, size, 80, 'rgba(125, 211, 252, 0.12)'],
  ] as const;
  glowPoints.forEach(([x, y, radius, color]) => {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
  context.globalAlpha = 1;

  cityTileTexture = new THREE.CanvasTexture(canvas);
  cityTileTexture.colorSpace = THREE.SRGBColorSpace;
  cityTileTexture.wrapS = THREE.RepeatWrapping;
  cityTileTexture.wrapT = THREE.RepeatWrapping;
  cityTileTexture.repeat.set(CITY_TILE_REPEATS, CITY_TILE_REPEATS);
  cityTileTexture.anisotropy = 4;
  cityTileTexture.needsUpdate = true;
  return cityTileTexture;
}

function createRoadSegment(length: number, width: number, color: string, rotation = 0, y = 0.02) {
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, length),
    new THREE.MeshBasicMaterial({
      color: '#04111c',
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    }),
  );
  road.position.y = y;
  road.rotation.y = rotation;

  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.08, width * 0.08), 0.09, length * 0.84),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  lane.position.y = y + 0.05;
  lane.rotation.y = rotation;

  const group = new THREE.Group();
  group.add(road, lane);
  return group;
}

function createNodeGlow(radius: number, color: string, opacity: number) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  glow.renderOrder = -1;
  return glow;
}

function createTileBase(radius: number, color: string, seed: number, roadCount: number) {
  const group = new THREE.Group();
  group.add(createNodeGlow(radius * 1.9, color, 0.36));

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.86, radius * 1.08, 0.38, 6),
    new THREE.MeshStandardMaterial({
      color: '#081923',
      emissive: color,
      emissiveIntensity: 0.12,
      metalness: 0.24,
      roughness: 0.62,
      transparent: true,
      opacity: 0.92,
    }),
  );
  plaza.position.y = 0.18;
  plaza.rotation.y = Math.PI / 6;
  group.add(plaza);

  for (let index = 0; index < roadCount; index += 1) {
    const angle = (index / roadCount) * Math.PI * 2 + seededUnit(seed + index) * 0.16;
    const road = createRoadSegment(radius * (1.8 + seededUnit(seed + index + 3) * 0.52), radius * 0.24, color, angle);
    road.position.x = Math.sin(angle) * radius * 0.62;
    road.position.z = Math.cos(angle) * radius * 0.62;
    group.add(road);
  }

  return group;
}

function createSurroundingBlocks(seed: number, color: string, radius: number, count: number) {
  const group = new THREE.Group();
  const blockMaterial = new THREE.MeshStandardMaterial({
    color: '#10212b',
    emissive: color,
    emissiveIntensity: 0.18,
    metalness: 0.16,
    roughness: 0.58,
  });

  for (let index = 0; index < count; index += 1) {
    const angle = seededUnit(seed + index * 2.3) * Math.PI * 2;
    const distance = radius * (0.72 + seededUnit(seed + index + 12.2) * 0.58);
    const width = radius * (0.11 + seededUnit(seed + index + 4.1) * 0.12);
    const depth = radius * (0.1 + seededUnit(seed + index + 5.7) * 0.1);
    const height = radius * (0.12 + seededUnit(seed + index + 7.8) * 0.34);
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), blockMaterial.clone());
    block.position.set(Math.cos(angle) * distance, 0.36 + height / 2, Math.sin(angle) * distance);
    block.rotation.y = angle + Math.PI * 0.25;
    group.add(block);
  }

  return group;
}

function createTileableCityEnvironment() {
  const group = new THREE.Group();
  group.name = 'sift-tileable-city-environment';

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_GRID_EXTENT, CITY_GRID_EXTENT),
    new THREE.MeshBasicMaterial({
      map: createTileableCityTexture(),
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = CITY_GROUND_Y;
  floor.renderOrder = -10;
  group.add(floor);

  const fogGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_GRID_EXTENT * 0.78, CITY_GRID_EXTENT * 0.78),
    new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      color: '#38bdf8',
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  fogGlow.rotation.x = -Math.PI / 2;
  fogGlow.position.y = CITY_GROUND_Y + 0.12;
  fogGlow.renderOrder = -9;
  group.add(fogGlow);

  const trunkMaterial = new THREE.MeshBasicMaterial({
    color: '#0ea5e9',
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  [-720, -360, 0, 360, 720].forEach((offset, index) => {
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(CITY_GRID_EXTENT, 0.08, 2.4), trunkMaterial.clone());
    horizontal.position.set(0, CITY_GROUND_Y + 0.24, offset);
    horizontal.rotation.y = index % 2 === 0 ? 0.04 : -0.035;
    group.add(horizontal);

    const vertical = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, CITY_GRID_EXTENT), trunkMaterial.clone());
    vertical.position.set(offset, CITY_GROUND_Y + 0.25, 0);
    vertical.rotation.y = index % 2 === 0 ? -0.03 : 0.05;
    group.add(vertical);
  });

  return group;
}

function disposeThreeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function makeLabel(text: string, color = '#f8fafc') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;

  if (context) {
    context.clearRect(0, 0, width, height);
    const haze = context.createRadialGradient(width / 2, height * 0.58, 0, width / 2, height * 0.58, width * 0.38);
    haze.addColorStop(0, 'rgba(8, 20, 32, 0.86)');
    haze.addColorStop(0.5, 'rgba(8, 20, 32, 0.35)');
    haze.addColorStop(1, 'rgba(8, 20, 32, 0)');
    context.fillStyle = haze;
    context.fillRect(0, 0, width, height);

    context.shadowColor = color;
    context.shadowBlur = 18;
    context.font = '700 32px Inter, sans-serif';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.slice(0, 34), width / 2, height / 2);
    context.shadowBlur = 0;

    context.fillStyle = color;
    context.globalAlpha = 0.7;
    context.fillRect(width * 0.34, height * 0.74, width * 0.32, 2);
    context.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(36, 9, 1);
  return sprite;
}

function createCityObject(node: GraphNode, flow?: PullRequestFlowSummary) {
  const group = new THREE.Group();
  const baseRadius = Math.max(7, Math.min(20, (node.val || 8) * 0.9));
  const baseHeight = 1.4;
  const towerHeight = Math.max(7, Math.min(36, 8 + Math.sqrt(node.stars || 0) / 80 + (node.repoCount || 0) * 0.6));
  const flowBoost = Math.min(8, flowTotal(flow) * 0.6);
  const seed = hashString(node.id);
  const color = node.color || '#38bdf8';

  group.add(createTileBase(baseRadius * 1.35, color, seed, 5));
  group.add(createSurroundingBlocks(seed + 21.4, color, baseRadius * 1.4, 12));

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.78, baseRadius * 1.02, baseHeight, 8),
    new THREE.MeshStandardMaterial({
      color: '#0b1724',
      emissive: color,
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
      color,
      emissive: color,
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
      emissive: color,
      emissiveIntensity: 0.7,
    }),
  );
  crown.position.y = baseHeight + towerHeight + flowBoost + 2;
  group.add(crown);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius * 0.55, 0.08, 6, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.position.y = baseHeight + towerHeight * 0.58 + flowBoost * 0.5;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

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
  const seed = hashString(node.id);

  group.add(createTileBase(width * 2.2, color, seed, 4));
  group.add(createSurroundingBlocks(seed + 14.2, color, width * 2.25, dimmed ? 2 : 4));

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

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.12, Math.max(0.2, width * 0.18), width * 1.12),
    new THREE.MeshStandardMaterial({
      color: '#dbeafe',
      emissive: color,
      emissiveIntensity: dimmed ? 0.08 : 0.38,
      metalness: 0.35,
      roughness: 0.28,
    }),
  );
  cap.position.y = height + Math.max(0.12, width * 0.09);
  cap.rotation.y = Math.PI * 0.25;
  group.add(cap);

  const windowMaterial = new THREE.MeshBasicMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: dimmed ? 0.08 : 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const windowRows = Math.max(2, Math.min(7, Math.floor(height / 2.2)));
  for (let index = 0; index < windowRows; index += 1) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, 0.08, 0.05), windowMaterial.clone());
    strip.position.set(0, 1 + index * (height - 1.5) / windowRows, width / 2 + 0.04);
    group.add(strip);
  }

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
  const environmentRef = useRef<THREE.Group | null>(null);
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

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let attempts = 0;

    const attachEnvironment = () => {
      if (cancelled) return;
      const scene = fgRef.current?.scene?.() as THREE.Scene | undefined;
      if (!scene) {
        attempts += 1;
        if (attempts < 30) frame = requestAnimationFrame(attachEnvironment);
        return;
      }

      if (environmentRef.current) {
        scene.remove(environmentRef.current);
        disposeThreeObject(environmentRef.current);
      }

      const environment = createTileableCityEnvironment();
      scene.add(environment);
      environmentRef.current = environment;
    };

    frame = requestAnimationFrame(attachEnvironment);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      const scene = fgRef.current?.scene?.() as THREE.Scene | undefined;
      if (environmentRef.current) {
        scene?.remove(environmentRef.current);
        disposeThreeObject(environmentRef.current);
        environmentRef.current = null;
      }
    };
  }, []);

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
      return createCityObject(node, flow);
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
      <div style="padding:9px 11px;border-radius:999px;background:radial-gradient(circle at 50% 0%, rgba(125,211,252,.26), rgba(2,6,23,.46) 68%, rgba(2,6,23,0));box-shadow:0 0 28px rgba(56,189,248,.24);color:#f8fafc;font:12px Inter,sans-serif;max-width:280px;backdrop-filter:blur(8px)">
        <div style="font-weight:750;margin-bottom:3px;text-shadow:0 0 18px rgba(226,246,255,.5)">${node.name}</div>
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
    <div className="absolute inset-0 z-0 overflow-hidden bg-[radial-gradient(circle_at_48%_42%,rgba(14,165,233,0.22),rgba(2,6,23,0.98)_68%)]">
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
        {flowMessage}
      </div>
      <ForceGraph3D
        ref={fgRef}
        width={windowSize.width}
        height={windowSize.height}
        graphData={augmentedGraphData}
        backgroundColor="#04111c"
        nodeThreeObject={nodeObject}
        nodeLabel={nodeLabel}
        onNodeClick={handleNodeClick}
        linkColor={(link: any) => {
          if (link.type === 'pr_flow_open') return 'rgba(34, 211, 238, 0.95)';
          if (link.type === 'pr_flow_merged') return 'rgba(168, 85, 247, 0.95)';
          if (link.type === 'pr_flow_closed') return 'rgba(148, 163, 184, 0.58)';
          return String(link.type || '').startsWith('grouped_by')
            ? 'rgba(45, 212, 191, 0.38)'
            : 'rgba(125, 211, 252, 0.2)';
        }}
        linkWidth={(link: any) => String(link.type || '').startsWith('pr_flow') ? Math.max(0.8, Math.min(3.8, link.value * 0.38)) : 0.72}
        linkOpacity={0.86}
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
