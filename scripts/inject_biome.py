import os

FILE_PATH = "frontend/app/page.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

start_sig = "function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {"
end_sig = "function repoDetailSeed(repo: Repo) {"

if start_sig not in content or end_sig not in content:
    print("Signatures not found!")
    exit(1)

pre_content = content.split(start_sig)[0]
post_content = content.split(end_sig)[1]

new_function = """function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {
  const district = districtFor(repo);
  const group = new THREE.Group();
  const layout = createRepoLayout(repo, index, districtRepos, heightScaleDriver);
  group.position.copy(layout.position);

  const shape = buildingShapeFor(repo, district);
  const baseColor = new THREE.Color(district.color);
  const bodyColor = baseColor.clone().lerp(new THREE.Color('#050708'), 0.1);
  const accentColor = new THREE.Color(district.accent);
  const isHighDetail = repo.stars >= 1000 || index % 5 === 0;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.48,
    metalness: 0.22,
    emissive: baseColor,
    emissiveIntensity: 0.026,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.36,
    metalness: 0.32,
    emissive: accentColor,
    emissiveIntensity: 0.08,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.7,
    emissive: accentColor,
    emissiveIntensity: 0.15,
  });

  let body: THREE.Mesh;
  let top: THREE.Mesh;
  let visualHeight = layout.height;
  let bodyWidth = layout.width;
  let bodyDepth = layout.depth;

  // Skyline Core / Vertical Arcology
  if (['spires', 'megatowers', 'vertical_arcology', 'skyline_core'].includes(shape)) {
    bodyWidth *= 0.6; bodyDepth *= 0.6; visualHeight *= 1.4;
    body = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.4, bodyWidth*0.8, visualHeight, 8), bodyMaterial);
    top = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.4, visualHeight*0.3, 8), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.15;
    if (isHighDetail) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(bodyWidth, 0.1, 8, 16), topMaterial);
      ring.position.y = visualHeight * 0.3;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  } 
  // Financial District / Data Engineering
  else if (['blocks', 'financial_district', 'data'].includes(shape)) {
    bodyWidth *= 1.2; bodyDepth *= 1.2; visualHeight *= 0.6;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), glassMaterial);
    top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*0.8, visualHeight*0.1, bodyDepth*0.8), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.05;
    if (isHighDetail) {
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.2, bodyWidth*0.2, visualHeight*0.2, 16), bodyMaterial);
      vent.position.y = visualHeight / 2 + visualHeight*0.1;
      vent.position.x = bodyWidth*0.2;
      group.add(vent);
    }
  }
  // Volcano Forge / Infrastructure
  else if (['lava_foundries', 'volcano_forge', 'reactors'].includes(shape)) {
    bodyWidth *= 1.3; bodyDepth *= 1.3; visualHeight *= 0.8;
    body = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.4, visualHeight, 6), bodyMaterial);
    top = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.15, bodyWidth*0.15, visualHeight*0.4, 6), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.2;
    if (isHighDetail) {
      const lava = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.16, bodyWidth*0.16, visualHeight*0.41, 6), new THREE.MeshBasicMaterial({color: '#ff2200', transparent: true, opacity: 0.8}));
      lava.position.copy(top.position);
      group.add(lava);
    }
  }
  // Frozen Kingdom / Crystals
  else if (['caves', 'frozen_kingdom', 'crystal_fields', 'crystal_spires'].includes(shape)) {
    bodyWidth *= 0.8; bodyDepth *= 0.8; visualHeight *= 1.2;
    body = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth, 0), glassMaterial);
    body.scale.set(1, visualHeight/bodyWidth, 1);
    top = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.3, visualHeight*0.4, 4), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.2;
    if (isHighDetail) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth*0.5, 0), glassMaterial);
      shard.position.set(bodyWidth*0.5, visualHeight*0.3, bodyDepth*0.5);
      shard.rotation.z = Math.PI / 4;
      group.add(shard);
    }
  }
  // Forest Repository / Redwood Archive / Natural
  else if (['giant_trees', 'forest_repository', 'redwood_archive', 'redwood_towers'].includes(shape)) {
    bodyWidth *= 0.9; bodyDepth *= 0.9; visualHeight *= 1.1;
    body = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.3, bodyWidth*0.6, visualHeight, 7), bodyMaterial);
    top = new THREE.Mesh(new THREE.DodecahedronGeometry(bodyWidth*0.8, 1), topMaterial);
    top.position.y = visualHeight / 2;
    if (isHighDetail) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, visualHeight*0.5, 5), bodyMaterial);
      root.position.set(bodyWidth*0.4, -visualHeight*0.25, 0);
      root.rotation.z = -Math.PI / 6;
      group.add(root);
    }
  }
  // Holographic / Floating / Ether Realm
  else if (['holographic', 'floating_stations', 'ether_realm', 'holographic_forms'].includes(shape)) {
    bodyWidth *= 0.9; bodyDepth *= 0.9; visualHeight *= 0.9;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), glassMaterial);
    body.position.y += visualHeight * 0.3; // Floating!
    top = new THREE.Mesh(new THREE.TetrahedronGeometry(bodyWidth*0.6, 0), topMaterial);
    top.position.y = visualHeight + visualHeight*0.3;
    if (isHighDetail) {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(bodyWidth*0.8, 0.05, 16, 32), topMaterial);
      halo.position.y = visualHeight*0.5;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    }
  }
  // Base default styles for everything else
  else {
    bodyWidth *= 0.8; bodyDepth *= 0.8; visualHeight *= 0.8;
    body = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), bodyMaterial);
    top = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*0.9, visualHeight*0.1, bodyDepth*0.9), topMaterial);
    top.position.y = visualHeight / 2 + visualHeight*0.05;
  }

  // Adjust body Y position to sit on ground unless it was explicitly floated
  if (body.position.y === 0) {
    body.position.y = visualHeight / 2;
  }

  body.userData.repoId = repo.id;
  top.userData.repoId = repo.id;
  group.add(body);
  group.add(top);

  // Instanced Windows
  const showWindows = repo.stars >= 50 && !['lava_foundries', 'volcano_forge', 'giant_trees', 'caves'].includes(shape);
  let windows: THREE.InstancedMesh;
  if (showWindows) {
    const windowGeometry = new THREE.PlaneGeometry(0.2, 0.15);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.4, depthWrite: false });
    const cols = Math.max(1, Math.floor(bodyWidth / 1.5));
    const rows = Math.max(1, Math.floor(visualHeight / 4));
    const litWindows = [];
    const dummy = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.4) {
          const wx = -bodyWidth/2 + 0.3 + c * (bodyWidth / cols);
          const wy = visualHeight*0.2 + r * (visualHeight*0.8 / rows);
          dummy.position.set(wx, wy, bodyDepth/2 + 0.05);
          dummy.updateMatrix();
          litWindows.push(dummy.matrix.clone());
        }
      }
    }
    windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, litWindows.length));
    litWindows.forEach((mat, i) => windows.setMatrixAt(i, mat));
  } else {
    windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0,0), new THREE.MeshBasicMaterial(), 1);
    windows.visible = false;
  }
  windows.userData.repoId = repo.id;
  group.add(windows);

  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  beacon.visible = false; ring.visible = false;
  group.add(beacon, ring);

  return {
    repo,
    district,
    group,
    body: body as RepoBuildingMesh,
    top: top as RepoBuildingMesh,
    windows: windows as RepoWindowsMesh,
    beacon,
    ring,
    position: layout.position.clone(),
    height: visualHeight,
    width: bodyWidth,
    depth: bodyDepth,
    phase: (repo.stars % 1000) / 1000,
  };
}

"""

with open(FILE_PATH, "w") as f:
    f.write(pre_content + new_function + "\n" + end_sig + post_content)

print("Successfully injected diverse biome architecture!")
