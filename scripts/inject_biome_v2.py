import os

FILE_PATH = "frontend/app/page.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

start_sig = "function createBuilding(repo: Repo, index: number, districtRepos: Repo[], heightScaleDriver: HeightScaleDriver) {"
end_sig = "function repoDetailSeed(repo: Repo) {"

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
  const isHighDetail = repo.stars >= 500 || index % 3 === 0;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.8,
    metalness: 0.1,
    emissive: baseColor,
    emissiveIntensity: 0.02,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.3,
    metalness: 0.4,
    emissive: accentColor,
    emissiveIntensity: 0.15,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.65,
    emissive: accentColor,
    emissiveIntensity: 0.25,
  });

  const plantMaterial = new THREE.MeshStandardMaterial({
    color: '#166534',
    roughness: 0.9,
    metalness: 0.0,
  });

  let visualHeight = layout.height;
  let bodyWidth = layout.width;
  let bodyDepth = layout.depth;

  // Track the primary body for edge rendering later
  let primaryBody: THREE.Mesh | null = null;
  let primaryTop: THREE.Mesh | null = null;

  // 1. SKYLINE CORE (Megatowers, Spire Clusters)
  if (['spires', 'megatowers', 'skyline_core'].includes(shape)) {
    bodyWidth *= 0.6; bodyDepth *= 0.6; visualHeight *= 1.8;
    const baseRadius = bodyWidth * 0.7;
    
    // Central Spire
    primaryBody = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius * 0.1, baseRadius, visualHeight, 16), glassMaterial);
    primaryBody.position.y = visualHeight / 2;
    group.add(primaryBody);
    
    // Orbiting spires
    if (isHighDetail) {
      for(let i=0; i<3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const subSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, baseRadius*0.4, visualHeight*0.6, 8), bodyMaterial);
        subSpire.position.set(Math.cos(angle)*baseRadius*0.8, visualHeight*0.3, Math.sin(angle)*baseRadius*0.8);
        subSpire.rotation.x = -0.1 * Math.cos(angle);
        subSpire.rotation.z = 0.1 * Math.sin(angle);
        group.add(subSpire);
      }
    }
  } 
  
  // 2. VERTICAL ARCOLOGY (Tiered terraces with greenery)
  else if (['vertical_arcology', 'apartments'].includes(shape)) {
    bodyWidth *= 1.4; bodyDepth *= 1.4; visualHeight *= 1.2;
    const tiers = 5;
    
    for (let i=0; i<tiers; i++) {
        const tierHeight = visualHeight / tiers;
        const radius = bodyWidth * (1 - i*0.15);
        
        const tierMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.9, radius, tierHeight, 16), bodyMaterial);
        tierMesh.position.y = (i * tierHeight) + tierHeight/2;
        group.add(tierMesh);
        
        // Balcony Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tierHeight*0.1, 8, 32), topMaterial);
        ring.rotation.x = Math.PI/2;
        ring.position.y = (i * tierHeight) + tierHeight;
        group.add(ring);
        
        // Greenery
        if (isHighDetail) {
            for(let g=0; g<4; g++) {
                const angle = Math.random() * Math.PI * 2;
                const bush = new THREE.Mesh(new THREE.SphereGeometry(tierHeight*0.4, 6, 6), plantMaterial);
                bush.position.set(Math.cos(angle)*radius, (i * tierHeight) + tierHeight, Math.sin(angle)*radius);
                group.add(bush);
            }
        }
    }
    primaryBody = group.children[0] as THREE.Mesh;
  }
  
  // 3. FOREST REPOSITORY / REDWOOD ARCHIVE (Giant Trees & Roots)
  else if (['giant_trees', 'forest_repository', 'redwood_archive', 'redwood_towers'].includes(shape)) {
    bodyWidth *= 1.2; bodyDepth *= 1.2; visualHeight *= 1.4;
    
    // Twisted Trunk
    primaryBody = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.3, bodyWidth*0.8, visualHeight, 9, 4, false), bodyMaterial);
    primaryBody.position.y = visualHeight / 2;
    // Distort vertices to make it organic
    const posAttribute = primaryBody.geometry.attributes.position;
    for(let i=0; i<posAttribute.count; i++) {
        const y = posAttribute.getY(i);
        const twist = y * 0.5;
        const x = posAttribute.getX(i);
        const z = posAttribute.getZ(i);
        posAttribute.setX(i, x * Math.cos(twist) - z * Math.sin(twist));
        posAttribute.setZ(i, x * Math.sin(twist) + z * Math.cos(twist));
    }
    primaryBody.geometry.computeVertexNormals();
    group.add(primaryBody);
    
    // Canopy
    const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(bodyWidth*1.1, 1), plantMaterial);
    canopy.position.y = visualHeight;
    canopy.scale.set(1, 0.6, 1);
    group.add(canopy);
    
    if (isHighDetail) {
        for(let r=0; r<5; r++) {
            const angle = (r/5)*Math.PI*2;
            const root = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.2, visualHeight*0.4, 5), bodyMaterial);
            root.position.set(Math.cos(angle)*bodyWidth*0.7, visualHeight*0.1, Math.sin(angle)*bodyWidth*0.7);
            root.rotation.x = Math.PI/4 * Math.cos(angle);
            root.rotation.z = -Math.PI/4 * Math.sin(angle);
            group.add(root);
        }
    }
  }
  
  // 4. CRYSTAL FIELDS (Jagged Prisms)
  else if (['caves', 'frozen_kingdom', 'crystal_fields', 'crystal_spires'].includes(shape)) {
    bodyWidth *= 0.9; visualHeight *= 1.3;
    
    primaryBody = new THREE.Mesh(new THREE.CylinderGeometry(0, bodyWidth, visualHeight, 6), glassMaterial);
    primaryBody.position.y = visualHeight / 2;
    group.add(primaryBody);
    
    if (isHighDetail) {
        for(let i=0; i<4; i++) {
            const angle = Math.random() * Math.PI*2;
            const height = visualHeight * (0.4 + Math.random()*0.5);
            const shard = new THREE.Mesh(new THREE.CylinderGeometry(0, bodyWidth*0.5, height, 5), glassMaterial);
            shard.position.set(Math.cos(angle)*bodyWidth*0.6, height/2, Math.sin(angle)*bodyWidth*0.6);
            shard.rotation.x = (Math.random()-0.5)*0.2;
            shard.rotation.z = (Math.random()-0.5)*0.2;
            group.add(shard);
        }
    }
  }
  
  // 5. VOLCANO FORGE (Jagged Lava Peaks)
  else if (['lava_foundries', 'volcano_forge', 'reactors'].includes(shape)) {
    bodyWidth *= 1.6; visualHeight *= 1.1;
    
    primaryBody = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth, visualHeight, 8), bodyMaterial);
    primaryBody.position.y = visualHeight / 2;
    // Rough displacement
    const posAttr = primaryBody.geometry.attributes.position;
    for(let i=0; i<posAttr.count; i++) {
        if(posAttr.getY(i) < visualHeight/2 - 0.1) {
            posAttr.setX(i, posAttr.getX(i) * (1 + Math.random()*0.2));
            posAttr.setZ(i, posAttr.getZ(i) * (1 + Math.random()*0.2));
        }
    }
    primaryBody.geometry.computeVertexNormals();
    group.add(primaryBody);
    
    // Lava Veins
    if (isHighDetail) {
        const vein = new THREE.Mesh(new THREE.ConeGeometry(bodyWidth*0.95, visualHeight*0.95, 7), new THREE.MeshBasicMaterial({color: '#ff3300', wireframe: true, transparent: true, opacity: 0.8}));
        vein.position.y = visualHeight / 2;
        group.add(vein);
    }
    
    // Smoke stack core
    const core = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth*0.2, bodyWidth*0.3, visualHeight*1.2, 8), new THREE.MeshBasicMaterial({color: '#ff1100'}));
    core.position.y = visualHeight*0.6;
    group.add(core);
  }
  
  // 6. ETHER REALM / HOLOGRAPHIC (Floating disconnected geometry)
  else if (['holographic', 'floating_stations', 'ether_realm', 'holographic_forms'].includes(shape)) {
    bodyWidth *= 1.1; visualHeight *= 1.1;
    
    const floatOffset = visualHeight * 0.4;
    
    primaryBody = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight*0.5, bodyWidth), glassMaterial);
    primaryBody.position.y = floatOffset + visualHeight*0.25;
    group.add(primaryBody);
    
    const wireframe = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*1.1, visualHeight*0.6, bodyWidth*1.1), new THREE.MeshBasicMaterial({color: accentColor, wireframe: true, transparent: true, opacity: 0.4}));
    wireframe.position.copy(primaryBody.position);
    group.add(wireframe);
    
    // Base platform
    const base = new THREE.Mesh(new THREE.CylinderGeometry(bodyWidth, bodyWidth*0.5, visualHeight*0.1, 4), bodyMaterial);
    base.position.y = visualHeight*0.05;
    base.rotation.y = Math.PI/4;
    group.add(base);
    
    if (isHighDetail) {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(bodyWidth*0.3, 0), topMaterial);
        core.position.copy(primaryBody.position);
        group.add(core);
    }
  }
  
  // 7. DEFAULT / FINANCIAL DISTRICT (Monolithic curved blocks)
  else {
    bodyWidth *= 1.1; bodyDepth *= 1.1; visualHeight *= 0.8;
    
    primaryBody = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, visualHeight, bodyDepth), bodyMaterial);
    primaryBody.position.y = visualHeight / 2;
    group.add(primaryBody);
    
    primaryTop = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth*0.8, visualHeight*0.15, bodyDepth*0.8), topMaterial);
    primaryTop.position.y = visualHeight + visualHeight*0.075;
    group.add(primaryTop);
    
    if (isHighDetail) {
        const support1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, visualHeight, 8), topMaterial);
        support1.position.set(bodyWidth*0.4, visualHeight/2, bodyDepth*0.4);
        const support2 = support1.clone();
        support2.position.set(-bodyWidth*0.4, visualHeight/2, -bodyDepth*0.4);
        group.add(support1, support2);
    }
  }

  // Assign standard required references
  if (!primaryBody) primaryBody = group.children[0] as THREE.Mesh;
  if (!primaryTop) primaryTop = primaryBody;

  primaryBody.userData.repoId = repo.id;
  primaryTop.userData.repoId = repo.id;

  // Instanced Windows (Only for shapes that support it)
  const supportsWindows = repo.stars >= 50 && !['lava_foundries', 'volcano_forge', 'giant_trees', 'caves', 'crystal_fields'].includes(shape);
  let windows: THREE.InstancedMesh;
  if (supportsWindows) {
    const windowGeometry = new THREE.PlaneGeometry(0.2, 0.15);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.5, depthWrite: false });
    const cols = Math.max(1, Math.floor(bodyWidth / 1.5));
    const rows = Math.max(1, Math.floor(visualHeight / 4));
    const litWindows = [];
    const dummy = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.3) {
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
    body: primaryBody as unknown as RepoBuildingMesh,
    top: primaryTop as unknown as RepoBuildingMesh,
    windows: windows as unknown as RepoWindowsMesh,
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
    f.write(pre_content + new_function + end_sig + post_content)

print("Injected V2 Ultra-Complex Biome Geometry!")
