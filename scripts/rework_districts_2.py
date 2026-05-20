import re

FILE_PATH = "frontend/app/page.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

# 1. Remove GitHub Connect link
old_connect = """          <a href="/api/github/auth">
            <Github size={13} strokeWidth={1.8} />
            Connect
          </a>"""
content = content.replace(old_connect, "")

# 2. Remove Repo load form
old_form = """        <form className="repo-load-form" onSubmit={handleRepoImport}>
          <input
            value={repoImport}
            onChange={(event) => setRepoImport(event.target.value)}
            placeholder="owner/repo"
            aria-label="Load GitHub repository"
          />
          <button type="submit" disabled={importingRepo}>
            <GitPullRequest size={13} strokeWidth={1.8} />
            {importingRepo ? 'Loading' : 'Load'}
          </button>
        </form>"""
content = content.replace(old_form, "")

# 3. Inject new createDistrictLandscaping logic
start_sig = "function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {"
end_sig = "function createGround(scene: THREE.Scene) {"

if start_sig not in content or end_sig not in content:
    print("Signatures for createDistrictLandscaping not found!")
    exit(1)

pre_content = content.split(start_sig)[0]
post_content = content.split(end_sig)[1]

new_function = """function createDistrictLandscaping(scene: THREE.Scene, district: District, districtIndex: number) {
  const palette = landscapePaletteFor(district);
  const centerX = district.x;
  const centerZ = district.z + 2;

  const group = new THREE.Group();
  group.position.set(centerX, 0, centerZ);
  
  const isNature = ['forest_repository', 'jungle_canopy', 'bamboo_valley', 'overgrown_ruins'].includes(district.key);
  const isLava = district.key === 'volcano_forge';
  const isIce = district.key === 'frozen_kingdom';
  const isCrystal = district.key === 'crystal_fields';
  const isFractured = district.key === 'ruined_empire';

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: palette.ground,
    roughness: isIce ? 0.2 : 0.8,
    metalness: isIce ? 0.5 : 0.1,
  });

  if (isLava) {
    const pit = new THREE.Mesh(new THREE.TorusGeometry(30, 15, 8, 16), baseMaterial);
    pit.rotation.x = Math.PI / 2;
    pit.position.y = -5;
    group.add(pit);
    
    // Add lava pools
    for(let i=0; i<4; i++) {
        const pool = new THREE.Mesh(new THREE.CircleGeometry(12 + Math.random()*8, 16), new THREE.MeshBasicMaterial({color: '#ff3300'}));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set((Math.random()-0.5)*50, 0.05, (Math.random()-0.5)*50);
        group.add(pool);
    }
  } else if (isIce || isCrystal) {
    for(let i=0; i<10; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(4 + Math.random()*6, 0), baseMaterial);
        shard.position.set((Math.random()-0.5)*80, 2 + Math.random()*4, (Math.random()-0.5)*80);
        shard.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(shard);
    }
  } else if (isNature) {
    for(let i=0; i<8; i++) {
        const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(8 + Math.random()*12, 1), new THREE.MeshStandardMaterial({color: '#064e3b', roughness: 0.9}));
        mound.position.set((Math.random()-0.5)*90, -2, (Math.random()-0.5)*90);
        group.add(mound);
    }
  } else if (isFractured) {
    for(let i=0; i<15; i++) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random()*10, 2 + Math.random()*8, 10 + Math.random()*10), baseMaterial);
        block.position.set((Math.random()-0.5)*80, 0, (Math.random()-0.5)*80);
        block.rotation.y = Math.random() * Math.PI;
        block.rotation.z = (Math.random() - 0.5) * 0.4;
        group.add(block);
    }
  } else {
    // Standard cyber grid block base
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(90, 2, 90), baseMaterial);
    basePlate.position.y = -1;
    group.add(basePlate);
  }

  scene.add(group);
}

"""

with open(FILE_PATH, "w") as f:
    f.write(pre_content + new_function + end_sig + post_content)

print("Removed GitHub connect UI and injected massive unique environmental floors!")
