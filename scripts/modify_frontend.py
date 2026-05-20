import re

FILE_PATH = 'frontend/app/page.tsx'

with open(FILE_PATH, 'r') as f:
    content = f.read()

# 1. Update DistrictKey
new_district_key = "type DistrictKey = string;"
content = re.sub(r"type DistrictKey = 'systems' \| 'web' \| 'ai' \| 'devtools' \| 'infra';", new_district_key, content)

# 2. Update District Shape
new_district_shape = "  shape: string;"
content = re.sub(r"  shape: 'spires' \| 'glass' \| 'clusters' \| 'wide' \| 'blocks';", new_district_shape, content)

# 3. Update DISTRICTS
new_districts = """const DISTRICTS: District[] = [
  { key: 'skyline_core', label: 'Skyline Core', color: '#ff6b6b', accent: '#ff9f80', x: 0, z: 0, shape: 'spires' },
  { key: 'financial_district', label: 'Financial District', color: '#fbbf24', accent: '#ffe08a', x: -20, z: -20, shape: 'blocks' },
  { key: 'vertical_arcology', label: 'Vertical Arcology', color: '#34d399', accent: '#8ff5ca', x: 20, z: -20, shape: 'megatowers' },
  { key: 'brick_boroughs', label: 'Brick Boroughs', color: '#f87171', accent: '#fca5a5', x: -40, z: 0, shape: 'apartments' },
  { key: 'neon_alley', label: 'Neon Alley Districts', color: '#c084fc', accent: '#e879f9', x: 40, z: 0, shape: 'glass' },
  { key: 'tech_suburbs', label: 'Tech Suburbs', color: '#60a5fa', accent: '#93c5fd', x: 0, z: 40, shape: 'suburban_homes' },
  { key: 'forest_repository', label: 'Forest Repository', color: '#4ade80', accent: '#86efac', x: -40, z: -40, shape: 'giant_trees' },
  { key: 'redwood_archive', label: 'Redwood Archive', color: '#166534', accent: '#22c55e', x: -60, z: -20, shape: 'giant_trees' },
  { key: 'jungle_canopy', label: 'Jungle Canopy', color: '#15803d', accent: '#4ade80', x: -20, z: -60, shape: 'mushroom_colonies' },
  { key: 'bamboo_valley', label: 'Bamboo Valley', color: '#84cc16', accent: '#bef264', x: 40, z: -40, shape: 'shrines' },
  { key: 'mountain_citadel', label: 'Mountain Citadel', color: '#94a3b8', accent: '#cbd5e1', x: 60, z: -20, shape: 'fortresses' },
  { key: 'volcano_forge', label: 'Volcano Forge', color: '#ef4444', accent: '#f87171', x: 20, z: -60, shape: 'reactors' },
  { key: 'frozen_kingdom', label: 'Frozen Kingdom', color: '#bae6fd', accent: '#e0f2fe', x: 40, z: -60, shape: 'castles' },
  { key: 'canyon_networks', label: 'Canyon Networks', color: '#b45309', accent: '#d97706', x: -60, z: 20, shape: 'caves' },
  { key: 'crystal_fields', label: 'Crystal Fields', color: '#a78bfa', accent: '#c4b5fd', x: -40, z: 40, shape: 'observatories' },
  { key: 'floating_island', label: 'Floating Island Systems', color: '#38bdf8', accent: '#7dd3fc', x: 60, z: 20, shape: 'floating_stations' },
  { key: 'ether_realm', label: 'Ether Realm', color: '#8b5cf6', accent: '#a78bfa', x: -20, z: 60, shape: 'holographic_forms' },
  { key: 'clockwork_empire', label: 'Clockwork Empire', color: '#ca8a04', accent: '#facc15', x: 20, z: 60, shape: 'factories' },
  { key: 'valley_villages', label: 'Valley Villages', color: '#65a30d', accent: '#a3e635', x: 40, z: 40, shape: 'stone_villages' },
  { key: 'nomad_camps', label: 'Nomad Camps', color: '#d97706', accent: '#fbbf24', x: -60, z: -60, shape: 'rooftop_villages' },
  { key: 'coastal_fishing', label: 'Coastal Fishing Towns', color: '#0ea5e9', accent: '#38bdf8', x: 60, z: -60, shape: 'shipyards' },
  { key: 'ruined_empire', label: 'Ruined Empire', color: '#475569', accent: '#64748b', x: -60, z: 60, shape: 'cathedrals' },
  { key: 'corruption_wasteland', label: 'Corruption Wasteland', color: '#7f1d1d', accent: '#991b1b', x: 60, z: 60, shape: 'refineries' },
  { key: 'overgrown_ruins', label: 'Overgrown Ruins', color: '#064e3b', accent: '#059669', x: 0, z: -40, shape: 'temples' }
];"""
content = re.sub(r"const DISTRICTS: District\[\] = \[\s*\{ key: 'systems'.*?\}\s*\];", new_districts, content, flags=re.DOTALL)

# 4. We must replace REPOS definition completely.
# `const REPOS: Repo[] = [...];`
# We'll replace it with an empty array.
content = re.sub(r"const REPOS: Repo\[\] = \[.*?\];", "const REPOS: Repo[] = [];", content, flags=re.DOTALL)

# 5. In Home component, we need to fetch data and assign biomes.
# The `effectiveRepos` relies on `REPOS`. Let's inject a state and fetch logic inside `Home()`.
home_start = "export default function Home() {"
fetch_logic = """export default function Home() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/py/graph-full?limit=600')
      .then(res => res.json())
      .then(data => {
        // Map the graph-full nodes to Repo objects
        const nodes = data.nodes.filter((n: any) => n.group === 'repository');
        
        // Complex biome clustering logic based on derived traits
        const mappedRepos: Repo[] = nodes.map((node: any) => {
          // Traits derivation
          const stars = node.stars || 0;
          const language = (node.language || '').toLowerCase();
          const topics = node.topics || [];
          const age = Math.random() * 10; // Mock age if not provided
          
          let biome: DistrictKey = 'tech_suburbs'; // Default
          
          // Basic clustering heuristics
          if (stars > 50000) biome = 'skyline_core';
          else if (stars > 10000 && topics.includes('finance')) biome = 'financial_district';
          else if (topics.includes('ml') || topics.includes('ai') || language === 'python') biome = 'neon_alley';
          else if (language === 'rust' || language === 'c' || language === 'c++') biome = 'clockwork_empire';
          else if (topics.includes('web') || language === 'typescript') biome = 'vertical_arcology';
          else if (language === 'go') biome = 'floating_island';
          else if (language === 'java') biome = 'mountain_citadel';
          else if (stars < 100) biome = 'valley_villages';
          else if (topics.includes('game')) biome = 'fantasy';
          else if (topics.includes('crypto')) biome = 'ether_realm';
          
          // Random fallback for variety if not explicitly mapped above
          const fallbackBiomes = ['forest_repository', 'frozen_kingdom', 'canyon_networks', 'crystal_fields'];
          if (biome === 'tech_suburbs' && Math.random() > 0.5) {
             biome = fallbackBiomes[Math.floor(Math.random() * fallbackBiomes.length)];
          }

          return {
            id: node.id.replace('repo_', ''),
            name: node.name,
            owner: node.owner,
            district: biome,
            language: node.language || 'Unknown',
            description: node.description || '',
            stars: stars,
            forks: node.forks || 0,
            openPRs: node.openIssues || 0,
            commitsPerWeek: 10,
            contributors: 10,
            goodFirstIssues: 0,
            safetyScore: node.safetyScore || 80,
            verifiedMaintainers: true,
            branchProtection: true,
            signedReleases: false,
            responseHours: 24,
            topics: topics,
            prs: []
          };
        });
        setRepos(mappedRepos);
        setLoadingRepos(false);
      })
      .catch(err => {
         console.error('Failed to fetch real GitHub data', err);
         setLoadingRepos(false);
      });
  }, []);
"""
content = content.replace(home_start, fetch_logic)

# Update `effectiveRepos` to use `repos` instead of `REPOS`
content = content.replace("return REPOS.map((repo)", "return repos.map((repo)")

with open(FILE_PATH, 'w') as f:
    f.write(content)

print("Modified page.tsx")
