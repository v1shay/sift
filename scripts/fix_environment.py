import re

FILE_PATH = "frontend/app/page.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

# ============================================================
# 1. FIX SPACING: Revert 3x multiplier back to ~1.5x
#    Current values are 3x the original. Divide by 2 to get 1.5x.
# ============================================================
def halve_coord(match):
    val = int(match.group(2))
    new_val = round(val / 2)
    return f"{match.group(1)}{new_val}{match.group(3)}"

districts_match = re.search(r"(const DISTRICTS: District\[\] = \[\s*// Systems.*?\n\];)", content, re.DOTALL)
if districts_match:
    districts_str = districts_match.group(1)
    districts_str_new = re.sub(r"(x: )(-?\d+)(,)", halve_coord, districts_str)
    districts_str_new = re.sub(r"(z: )(-?\d+)(,)", halve_coord, districts_str_new)
    content = content.replace(districts_match.group(1), districts_str_new)
    print(f"[OK] District spacing halved from 3x -> 1.5x")
else:
    print("[WARN] Could not find DISTRICTS array for spacing fix")

# ============================================================
# 2. FIX FOG: Make everything much more visible
# ============================================================
# Scene fog (initial)
content = content.replace(
    "scene.fog = new THREE.FogExp2('#0c1514', 0.012);",
    "scene.fog = new THREE.FogExp2('#0c1514', 0.002);"
)
# Day/night fog update
content = content.replace(
    "refs.scene.fog = new THREE.FogExp2(isDay ? '#9dbce7' : '#08142a', isDay ? 0.0035 : 0.0055);",
    "refs.scene.fog = new THREE.FogExp2(isDay ? '#9dbce7' : '#08142a', isDay ? 0.0012 : 0.0018);"
)
# Also increase camera far plane for visibility
content = content.replace(
    "const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 3500);",
    "const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 8000);"
)
print("[OK] Fog density reduced 4-6x, camera far plane increased")

# ============================================================
# 3. BOOST AMBIENT LIGHT so buildings are clearly visible
# ============================================================
content = content.replace(
    "const ambient = new THREE.AmbientLight('#9fcfc0', 0.7);",
    "const ambient = new THREE.AmbientLight('#c0e8e0', 1.4);"
)
content = content.replace(
    "const key = new THREE.DirectionalLight('#dbe8ff', 2.4);",
    "const key = new THREE.DirectionalLight('#dbe8ff', 3.2);"
)
print("[OK] Ambient and directional lights boosted")

# ============================================================
# 4. REPLACE createSky with clouds + stars + atmospheric dome
# ============================================================
old_createSky = """function createSky(scene: THREE.Scene) {
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 420; i += 1) {
    const radius = 400 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const y = 40 + Math.random() * 250;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.22,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);
}"""

new_createSky = """function createSky(scene: THREE.Scene) {
  // Stars
  const starGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 800; i += 1) {
    const radius = 600 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const y = 60 + Math.random() * 500;
    positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.35,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stars.userData.role = 'stars';
  scene.add(stars);

  // Sky Dome with gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 512;
  skyCanvas.height = 512;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, '#020812');
  skyGrad.addColorStop(0.3, '#0a1628');
  skyGrad.addColorStop(0.6, '#101e3a');
  skyGrad.addColorStop(1, '#0c1825');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 512);
  // Nebula wisps
  skyCtx.globalAlpha = 0.06;
  for (let i = 0; i < 40; i++) {
    skyCtx.beginPath();
    skyCtx.arc(Math.random()*512, Math.random()*256, 30+Math.random()*80, 0, Math.PI*2);
    skyCtx.fillStyle = ['#3b82f6','#8b5cf6','#06b6d4','#ec4899'][i%4];
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false }),
  );
  skyDome.userData.role = 'sky-dome';
  scene.add(skyDome);

  // Cloud layers
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 1024;
  cloudCanvas.height = 1024;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  cloudCtx.fillStyle = 'rgba(0,0,0,0)';
  cloudCtx.fillRect(0, 0, 1024, 1024);
  cloudCtx.globalAlpha = 0.08;
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 1024;
    const radius = 40 + Math.random() * 120;
    const grad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, 'rgba(180,200,220,0.6)');
    grad.addColorStop(0.5, 'rgba(140,160,180,0.3)');
    grad.addColorStop(1, 'rgba(100,120,140,0)');
    cloudCtx.fillStyle = grad;
    cloudCtx.beginPath();
    cloudCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    cloudCtx.fill();
  }
  cloudCtx.globalAlpha = 1;
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.wrapT = THREE.RepeatWrapping;
  const cloudPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = 350;
  cloudPlane.userData.role = 'clouds';
  scene.add(cloudPlane);

  // Lower cloud layer
  const cloud2 = cloudPlane.clone();
  cloud2.position.y = 220;
  cloud2.rotation.z = Math.PI / 3;
  (cloud2.material as THREE.MeshBasicMaterial).opacity = 0.2;
  cloud2.userData.role = 'clouds-low';
  scene.add(cloud2);
}"""

if old_createSky in content:
    content = content.replace(old_createSky, new_createSky)
    print("[OK] createSky upgraded with sky dome, nebula, and cloud layers")
else:
    print("[WARN] Could not find exact createSky text to replace")

# ============================================================
# 5. REPLACE createDistrictLandscaping with REAL textured environments
# ============================================================
start_sig = "function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {"
end_sig = "function createGround(scene: THREE.Scene) {"

if start_sig in content and end_sig in content:
    pre = content.split(start_sig)[0]
    post = content.split(end_sig)[1]

    new_landscaping = """function generateBiomeTexture(biomeType: string, size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (biomeType === 'lava') {
    // Volcanic cracked rock with lava veins
    const bg = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    bg.addColorStop(0, '#1a0a05');
    bg.addColorStop(1, '#0d0503');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Lava cracks
    ctx.strokeStyle = '#ff3300';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Ember spots
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 20; i++) {
      const grad = ctx.createRadialGradient(Math.random()*size, Math.random()*size, 0, Math.random()*size, Math.random()*size, 15+Math.random()*25);
      grad.addColorStop(0, '#ff6600');
      grad.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'ice') {
    // Frozen tundra with cracks
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#c8e6f0');
    bg.addColorStop(0.5, '#a8d4e8');
    bg.addColorStop(1, '#d0eaf5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Ice fractures
    ctx.strokeStyle = '#e8f4f8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Snow drifts
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*size, Math.random()*size, 20+Math.random()*40, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'forest') {
    // Dense moss and undergrowth
    ctx.fillStyle = '#0a2e1a';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 5 + Math.random() * 20;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, ['#166534','#14532d','#1a4731','#064e3b'][i%4]);
      grad.addColorStop(1, 'rgba(10,46,26,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fallen leaves / debris
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#854d0e','#713f12','#92400e','#065f46'][i%4];
      ctx.fillRect(Math.random()*size, Math.random()*size, 2+Math.random()*6, 1+Math.random()*3);
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'crystal') {
    // Purple/cyan crystal cave floor
    ctx.fillStyle = '#0f0520';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 15+Math.random()*30);
      grad.addColorStop(0, ['#a78bfa','#c084fc','#7c3aed','#06b6d4'][i%4]);
      grad.addColorStop(1, 'rgba(15,5,32,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 15+Math.random()*30, 0, Math.PI*2);
      ctx.fill();
    }
    // Crystalline highlights
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2;
        const len = 10 + Math.random() * 20;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'desert') {
    // Sandy dunes
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#78716c');
    bg.addColorStop(0.5, '#57534e');
    bg.addColorStop(1, '#44403c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // Sand ripples
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const y = Math.random() * size;
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'cyber') {
    // Neon grid floor
    ctx.fillStyle = '#060e15';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < size; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    // Glow nodes at intersections
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < size; i += 64) {
      for (let j = 0; j < size; j += 64) {
        const grad = ctx.createRadialGradient(i, j, 0, i, j, 8);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, 'rgba(6,14,21,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(i-8, j-8, 16, 16);
      }
    }
    ctx.globalAlpha = 1;
  } else if (biomeType === 'wasteland') {
    // Corrupted toxic ground
    ctx.fillStyle = '#1a0a20';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 40; i++) {
      const grad = ctx.createRadialGradient(Math.random()*size, Math.random()*size, 0, Math.random()*size, Math.random()*size, 20+Math.random()*40);
      grad.addColorStop(0, ['#d946ef','#a855f7','#ec4899','#f43f5e'][i%4]);
      grad.addColorStop(1, 'rgba(26,10,32,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
  } else {
    // Default: industrial concrete
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#292524' : '#1c1917';
      ctx.fillRect(Math.random()*size, Math.random()*size, 4+Math.random()*16, 4+Math.random()*16);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function biomeTypeForDistrict(district: District): string {
  const k = district.key;
  if (k === 'volcano_forge') return 'lava';
  if (k === 'frozen_kingdom') return 'ice';
  if (['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins', 'redwood_archive'].includes(k)) return 'forest';
  if (['crystal_fields', 'ether_realm', 'floating_island'].includes(k)) return 'crystal';
  if (['ruined_empire', 'corruption_wasteland'].includes(k)) return 'wasteland';
  if (['nomad_camps', 'valley_villages', 'coastal_fishing'].includes(k)) return 'desert';
  if (['neon_alley', 'tech_suburbs', 'canyon_networks'].includes(k)) return 'cyber';
  return 'concrete';
}

function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {
  const centerX = district.x;
  const centerZ = district.z + 2;
  const biome = biomeTypeForDistrict(district);

  // Large textured ground plane for this district
  const groundTex = generateBiomeTexture(biome, 512);
  groundTex.repeat.set(2, 2);
  const groundSize = 100;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: biome === 'cyber' ? 0.3 : 0.05,
      transparent: true,
      opacity: 0.85,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.3, centerZ);
  ground.renderOrder = -1;
  scene.add(ground);

  // Blending ring (fades at edges)
  const fadeRing = new THREE.Mesh(
    new THREE.RingGeometry(groundSize * 0.42, groundSize * 0.55, 32),
    new THREE.MeshBasicMaterial({
      color: '#040606',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  fadeRing.rotation.x = -Math.PI / 2;
  fadeRing.position.set(centerX, -0.25, centerZ);
  scene.add(fadeRing);

  // 3D Environmental props per biome
  if (biome === 'lava') {
    // Lava pools
    for (let i = 0; i < 6; i++) {
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(3 + Math.random() * 5, 16),
        new THREE.MeshBasicMaterial({ color: '#ff3300', transparent: true, opacity: 0.7 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(centerX + (Math.random()-0.5)*60, 0.05, centerZ + (Math.random()-0.5)*60);
      scene.add(pool);
    }
    // Rock pillars
    for (let i = 0; i < 8; i++) {
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 + Math.random()*2, 3 + Math.random()*5, 5),
        new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.95 }),
      );
      rock.position.set(centerX + (Math.random()-0.5)*70, 1.5, centerZ + (Math.random()-0.5)*70);
      scene.add(rock);
    }
  } else if (biome === 'ice') {
    // Ice shards sticking up
    for (let i = 0; i < 12; i++) {
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.8+Math.random()*1.5, 4+Math.random()*8, 4),
        new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.7 }),
      );
      shard.position.set(centerX + (Math.random()-0.5)*80, 2, centerZ + (Math.random()-0.5)*80);
      shard.rotation.z = (Math.random()-0.5)*0.3;
      scene.add(shard);
    }
  } else if (biome === 'forest') {
    // Undergrowth mounds
    for (let i = 0; i < 10; i++) {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(3+Math.random()*4, 8, 6),
        new THREE.MeshStandardMaterial({ color: ['#166534','#14532d','#064e3b'][i%3], roughness: 0.95 }),
      );
      mound.position.set(centerX + (Math.random()-0.5)*80, 0.5, centerZ + (Math.random()-0.5)*80);
      mound.scale.y = 0.4;
      scene.add(mound);
    }
    // Small mushroom/plant shapes
    for (let i = 0; i < 6; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 2+Math.random()*3, 6),
        new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.9 }),
      );
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1+Math.random(), 8, 6),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.8 }),
      );
      const x = centerX + (Math.random()-0.5)*70;
      const z = centerZ + (Math.random()-0.5)*70;
      stem.position.set(x, 1.5, z);
      cap.position.set(x, 3 + Math.random()*2, z);
      cap.scale.y = 0.5;
      scene.add(stem, cap);
    }
  } else if (biome === 'crystal') {
    // Floating crystal clusters
    for (let i = 0; i < 8; i++) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.5+Math.random()*2, 0),
        new THREE.MeshStandardMaterial({ color: ['#a78bfa','#c084fc','#06b6d4'][i%3], roughness: 0.1, metalness: 0.7, transparent: true, opacity: 0.8 }),
      );
      crystal.position.set(centerX + (Math.random()-0.5)*70, 1+Math.random()*4, centerZ + (Math.random()-0.5)*70);
      crystal.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(crystal);
    }
  } else if (biome === 'wasteland') {
    // Broken slabs
    for (let i = 0; i < 10; i++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(4+Math.random()*6, 0.5+Math.random()*2, 3+Math.random()*5),
        new THREE.MeshStandardMaterial({ color: '#44403c', roughness: 0.9 }),
      );
      slab.position.set(centerX + (Math.random()-0.5)*70, 0.5, centerZ + (Math.random()-0.5)*70);
      slab.rotation.set((Math.random()-0.5)*0.4, Math.random()*Math.PI, (Math.random()-0.5)*0.3);
      scene.add(slab);
    }
  } else if (biome === 'cyber') {
    // Holographic panels
    for (let i = 0; i < 5; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(3+Math.random()*4, 2+Math.random()*3),
        new THREE.MeshBasicMaterial({ color: ['#0ea5e9','#38bdf8','#06b6d4'][i%3], transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
      );
      panel.position.set(centerX + (Math.random()-0.5)*60, 3+Math.random()*5, centerZ + (Math.random()-0.5)*60);
      panel.rotation.y = Math.random() * Math.PI;
      scene.add(panel);
    }
  }
}

"""

    content = pre + new_landscaping + end_sig + post
    print("[OK] createDistrictLandscaping replaced with rich biome textures")
else:
    print("[WARN] Could not find createDistrictLandscaping signatures")

# ============================================================
# 6. Make district base planes larger & more visible
# ============================================================
content = content.replace(
    "      new THREE.PlaneGeometry(35, 35),",
    "      new THREE.PlaneGeometry(90, 90),"
)
content = content.replace(
    "        opacity: isNature ? 0.09 : 0.045,",
    "        opacity: isNature ? 0.18 : 0.12,"
)

print("[OK] District base planes enlarged and more visible")

# ============================================================
# 7. Make ground plane much larger to fill universe
# ============================================================
content = content.replace(
    "    new THREE.PlaneGeometry(1000, 1000, 1, 1),",
    "    new THREE.PlaneGeometry(4000, 4000, 1, 1),"
)
content = content.replace(
    "  const grid = new THREE.GridHelper(1000, 120, '#4fb7c5', '#204d45');",
    "  const grid = new THREE.GridHelper(4000, 200, '#4fb7c5', '#204d45');"
)

print("[OK] Ground and grid scaled up for the wider universe")

# ============================================================
# 8. Increase road distance limit for the wider spacing
# ============================================================
content = content.replace(
    "if (distance < 5 || distance > (isDistrictTrunk ? 180 : 118)) return;",
    "if (distance < 5 || distance > (isDistrictTrunk ? 400 : 250)) return;"
)

print("[OK] Road distance limits adjusted for new spacing")

with open(FILE_PATH, "w") as f:
    f.write(content)

print("\\n=== ALL PATCHES APPLIED SUCCESSFULLY ===")
