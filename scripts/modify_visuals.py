import re
import os

FILE_PATH = 'frontend/app/page.tsx'

with open(FILE_PATH, 'r') as f:
    content = f.read()

visual_code = """
function createBuilding(repo: Repo, index: number, districtRepos: Repo[]) {
  const district = districtFor(repo);
  const layout = createRepoLayout(repo, index, districtRepos);
  const group = new THREE.Group();
  group.position.copy(layout.position);

  const shape = district.shape;
  
  let baseGeo;
  let topGeo;
  
  // Choose geometry based on shape
  if (['spires', 'megatowers', 'apartments', 'glass'].includes(shape)) {
    baseGeo = new THREE.BoxGeometry(layout.width, layout.height, layout.depth);
    topGeo = new THREE.BoxGeometry(layout.width + 0.2, 0.5, layout.depth + 0.2);
  } else if (['suburban_homes', 'rooftop_villages'].includes(shape)) {
    baseGeo = new THREE.BoxGeometry(layout.width, layout.height * 0.4, layout.depth);
    topGeo = new THREE.ConeGeometry(Math.max(layout.width, layout.depth) * 0.8, layout.height * 0.6, 4);
  } else if (['giant_trees', 'mushroom_colonies'].includes(shape)) {
    baseGeo = new THREE.CylinderGeometry(layout.width*0.3, layout.width*0.5, layout.height, 8);
    topGeo = new THREE.SphereGeometry(layout.width, 8, 8);
  } else if (['shrines', 'temples', 'cathedrals'].includes(shape)) {
    baseGeo = new THREE.CylinderGeometry(layout.width*0.8, layout.width, layout.height, 4);
    topGeo = new THREE.CylinderGeometry(0, layout.width*0.9, layout.height*0.5, 4);
  } else if (['fortresses', 'castles'].includes(shape)) {
    baseGeo = new THREE.BoxGeometry(layout.width, layout.height, layout.depth);
    topGeo = new THREE.BoxGeometry(layout.width, 0.5, layout.depth);
  } else if (['reactors', 'refineries', 'factories'].includes(shape)) {
    baseGeo = new THREE.CylinderGeometry(layout.width*0.5, layout.width*0.5, layout.height, 16);
    topGeo = new THREE.TorusGeometry(layout.width*0.5, 0.2, 8, 16);
    topGeo.rotateX(Math.PI/2);
  } else if (['caves', 'stone_villages'].includes(shape)) {
    baseGeo = new THREE.DodecahedronGeometry(layout.width);
    baseGeo.scale(1, layout.height/layout.width, 1);
    topGeo = new THREE.BoxGeometry(0,0,0);
  } else if (['observatories'].includes(shape)) {
    baseGeo = new THREE.CylinderGeometry(layout.width*0.5, layout.width*0.5, layout.height, 12);
    topGeo = new THREE.SphereGeometry(layout.width*0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  } else if (['floating_stations', 'holographic_forms'].includes(shape)) {
    baseGeo = new THREE.OctahedronGeometry(layout.width);
    baseGeo.scale(1, layout.height/layout.width, 1);
    topGeo = new THREE.RingGeometry(layout.width*1.2, layout.width*1.5, 16);
    topGeo.rotateX(Math.PI/2);
    group.position.y += 5 + (repo.stars % 10) * 0.5; // floating effect
  } else if (['shipyards'].includes(shape)) {
    baseGeo = new THREE.BoxGeometry(layout.width*1.5, layout.height*0.3, layout.depth*2);
    topGeo = new THREE.CylinderGeometry(0.2, 0.2, layout.height, 4);
  } else {
    // fallback
    baseGeo = new THREE.BoxGeometry(layout.width, layout.height, layout.depth);
    topGeo = new THREE.BoxGeometry(layout.width + 0.2, 0.2, layout.depth + 0.2);
  }

  const isHolo = shape === 'holographic_forms';
  
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: isHolo ? district.color : '#071123',
    roughness: isHolo ? 0.1 : 0.6,
    metalness: isHolo ? 0.9 : 0.3,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: isHolo ? 0.8 : 0.05,
    wireframe: isHolo,
    transparent: isHolo,
    opacity: isHolo ? 0.5 : 1
  });
  
  const body = new THREE.Mesh(baseGeo, bodyMaterial);
  body.position.y = layout.height / 2;
  body.castShadow = !isHolo;
  body.receiveShadow = !isHolo;
  body.userData.repoId = repo.id;
  group.add(body);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(district.accent),
    roughness: 0.3,
    metalness: 0.5,
    emissive: new THREE.Color(district.color),
    emissiveIntensity: 0.3,
    wireframe: isHolo
  });
  const top = new THREE.Mesh(topGeo, topMaterial);
  top.position.y = layout.height + (topGeo.parameters?.height || topGeo.parameters?.radius || 0.5) / 2;
  top.userData.repoId = repo.id;
  group.add(top);

  // Edges only for boxy shapes
  if (['spires', 'megatowers', 'apartments', 'glass'].includes(shape)) {
    const edgeGeometry = new THREE.EdgesGeometry(baseGeo);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: district.color, transparent: true, opacity: 0.15 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(body.position);
    group.add(edges);
  }

  // Windows for residential/industrial/office
  if (['spires', 'megatowers', 'apartments', 'glass', 'factories'].includes(shape)) {
    const windowGeometry = new THREE.PlaneGeometry(0.3, 0.2);
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cols = Math.max(2, Math.floor(layout.width / 0.8));
    const rows = Math.max(3, Math.floor(layout.height / 1.1));
    const litWindows: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const litSeed = Math.sin((row + 1) * 12.9 + (col + 1) * 78.2 + repo.stars * 0.001);
        if (litSeed - Math.floor(litSeed) < 0.4) continue;
        const wx = -layout.width / 2 + 0.5 + col * ((layout.width - 1.0) / Math.max(1, cols - 1));
        const wy = 0.8 + row * ((layout.height - 1.6) / rows);
        dummy.position.set(wx, wy, layout.depth / 2 + 0.02);
        dummy.updateMatrix();
        litWindows.push(dummy.matrix.clone());
      }
    }
    const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
    litWindows.forEach((matrix, matrixIndex) => windows.setMatrixAt(matrixIndex, matrix));
    windows.userData.repoId = repo.id;
    group.add(windows);
  } else {
    // Add dummy windows to satisfy BuildingObject type
    const dummyWindows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0,0), new THREE.MeshBasicMaterial(), 1);
    group.add(dummyWindows);
  }

  const antennaHeight = 1.5 + (repo.openPRs % 10) * 0.2;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, antennaHeight, 8),
    new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5 }),
  );
  antenna.position.set(0, top.position.y + antennaHeight / 2, 0);
  if (!['caves', 'giant_trees', 'mushroom_colonies'].includes(shape)) {
    group.add(antenna);
  }

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: district.accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
  );
  beacon.position.set(0, antenna.position.y + antennaHeight / 2 + 0.2, 0);
  if (!['caves', 'giant_trees', 'mushroom_colonies'].includes(shape)) {
    group.add(beacon);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(layout.width, layout.depth) * 0.8, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);

  // Fulfilling type BuildingObject
  let windowsObj = group.children.find(c => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;

  return {
    repo,
    district,
    group,
    body,
    top,
    windows: windowsObj,
    beacon,
    ring,
    position: layout.position.clone(),
    height: layout.height,
    width: layout.width,
    depth: layout.depth,
    phase: (repo.stars % 1000) / 1000,
  };
}

function createGround(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300, 1, 1),
    new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      roughness: 0.9,
      metalness: 0.1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.userData.role = 'ground';
  scene.add(ground);

  const grid = new THREE.GridHelper(300, 100, '#4f8cff', '#16345f');
  grid.userData.role = 'grid';
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.1;
  grid.position.y = 0.01;
  scene.add(grid);

  DISTRICTS.forEach((district) => {
    const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins'].includes(district.key);
    const isLava = district.key === 'volcano_forge';
    const isIce = district.key === 'frozen_kingdom';
    
    let planeColor = district.color;
    if (isNature) planeColor = '#064e3b';
    if (isLava) planeColor = '#450a0a';
    if (isIce) planeColor = '#e0f2fe';

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(35, 35),
      new THREE.MeshBasicMaterial({
        color: planeColor,
        transparent: true,
        opacity: isNature ? 0.2 : 0.08,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(district.x, 0.02, district.z + 2);
    plane.userData.role = 'district-plane';
    scene.add(plane);

    const labelTexture = makeSpriteTexture(district.label.toUpperCase(), 'semantic district', district.color, 520, 130);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.8, depthWrite: false }));
    label.position.set(district.x, 1.4, district.z + 22);
    label.scale.set(12, 3, 1);
    scene.add(label);
  });
}

function createSky(scene: THREE.Scene) {
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 2000; i += 1) {
    const radius = 100 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const y = 20 + Math.random() * 150;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.3,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 32),
    new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending }),
  );
  moon.position.set(120, 80, -150);
  moon.userData.role = 'moon';
  scene.add(moon);
}

function createRoads(scene: THREE.Scene, buildings: BuildingObject[]) {
  const roads: RoadObject[] = [];
  buildings.forEach((building, index) => {
    if (building.repo.prs.length === 0 && index % 3 !== 0) return;
    
    // connect to 1-3 random buildings to show flow
    const connections = 1 + (building.repo.stars % 3);
    for(let i=0; i<connections; i++) {
        const target = buildings[(index + i * 17) % buildings.length];
        if (target === building) continue;

        const dist = building.position.distanceTo(target.position);
        if (dist > 60 || dist < 5) continue; // Only connect local-ish nodes

        const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley'].includes(building.district.key);
        const isLava = building.district.key === 'volcano_forge';
        const isIce = building.district.key === 'frozen_kingdom';
        
        let pathColor = building.district.color;
        if(isNature) pathColor = '#22c55e'; // vine paths
        if(isLava) pathColor = '#ef4444'; // lava paths
        if(isIce) pathColor = '#bae6fd'; // ice paths

        const p1 = building.position.clone();
        const p2 = target.position.clone();
        
        const midY = (isNature || building.district.shape === 'floating_stations') ? 10 : 0.5;

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(p1.x, 0.2, p1.z),
          new THREE.Vector3((p1.x + p2.x) / 2, midY + (dist * 0.1), (p1.z + p2.z) / 2),
          new THREE.Vector3(p2.x, 0.2, p2.z),
        ]);

        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 20, 0.08, 4, false),
          new THREE.MeshBasicMaterial({ color: pathColor, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending })
        );
        scene.add(mesh);

        const cars: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
        for (let c = 0; c < 3; c += 1) {
          const car = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.8 })
          );
          scene.add(car);
          cars.push(car);
        }

        const labelTexture = makeSpriteTexture(`${building.repo.prs.length || 1} PRs`, 'flow', pathColor, 200, 60);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0, depthWrite: false }));
        scene.add(label);

        roads.push({
          id: `${building.repo.id}-${target.repo.id}-${i}`,
          source: building.repo,
          target: target.repo,
          curve,
          mesh,
          cars,
          label,
          speed: 0.1 + (building.repo.stars % 5) * 0.02,
          phase: Math.random(),
        });
    }
  });
  return roads;
}

"""

# Re-run modification but replacing the functions entirely.
# First, let's find the start and end of these functions to slice them out.
# This requires a bit of parsing. I will use regex with DOTALL to replace them.

def replace_function(content, func_name, new_code):
    # Matches from function func_name( to the end of the function.
    # It assumes the function is at the top level and ends with \n}\n
    pattern = re.compile(rf"function {func_name}\(.*?^}}\n", re.MULTILINE | re.DOTALL)
    match = pattern.search(content)
    if match:
        # Instead of replacing, we will just inject all new visual_code at the end of the file 
        # and remove the old functions. Or better, just regex replace them.
        return content.replace(match.group(0), "")
    return content

# Remove old functions
for fn in ['createBuilding', 'createGround', 'createSky', 'createRoads']:
    content = replace_function(content, fn, "")

# Remove the one definition of `createBuilding` we found earlier, which might have extra trailing spaces
# If the above fails, let's just use string finding.

import ast

# Actually, the safest way to replace these is to just comment out the old ones and append the new ones.
# Or since we know they are in page.tsx, let's just append visual_code to the end, 
# and rename the original ones in the file if they conflict. Or simply let typescript/javascript hoist the last defined function? No, TS will complain about duplicate function implementations.

# Let's do it manually with split
parts = content.split("function createBuilding(repo: Repo, index: number, districtRepos: Repo[]) {")
if len(parts) > 1:
    pre = parts[0]
    # find the end of createBuilding
    # this is dangerous because of nested brackets. 
    
# Let's write a python parser to remove the functions.
def extract_function(source, func_name):
    # super naive bracket counting
    start_idx = source.find(f"function {func_name}(")
    if start_idx == -1: return source
    
    bracket_count = 0
    in_function = False
    end_idx = start_idx
    for i in range(start_idx, len(source)):
        if source[i] == '{':
            bracket_count += 1
            in_function = True
        elif source[i] == '}':
            bracket_count -= 1
        
        if in_function and bracket_count == 0:
            end_idx = i + 1
            break
            
    return source[:start_idx] + source[end_idx:]

for fn in ['createBuilding', 'createGround', 'createSky', 'createRoads']:
    content = extract_function(content, fn)

# Append new visual code
content += "\n" + visual_code

# Write back
with open(FILE_PATH, 'w') as f:
    f.write(content)

print("Replaced visual functions")
