import re

FILE_PATH = "frontend/app/page.tsx"

with open(FILE_PATH, "r") as f:
    content = f.read()

# 1. Update District Spacing
def multiply_coord(match):
    val = int(match.group(2))
    new_val = val * 3
    return f"{match.group(1)}{new_val}{match.group(3)}"

# Find the DISTRICTS array
districts_match = re.search(r'(const DISTRICTS: District\[\] = \[\s*// Systems.*?\n\];)', content, re.DOTALL)
if districts_match:
    districts_str = districts_match.group(1)
    # Multiply x and z by 3
    districts_str = re.sub(r'(x: )(-?\d+)(,)', multiply_coord, districts_str)
    districts_str = re.sub(r'(z: )(-?\d+)(,)', multiply_coord, districts_str)
    content = content.replace(districts_match.group(1), districts_str)

# 2. Fix Z-fighting in createGround
# ground.position.y = -0.05 -> ground.position.y = -1.0;
content = content.replace("ground.position.y = -0.05;", "ground.position.y = -1.5;")
# grid.position.y = 0.01 -> grid.position.y = -0.75;
content = content.replace("grid.position.y = 0.01;", "grid.position.y = -0.75;")
# district plane: plane.position.set(district.x, 0.02, district.z + 2); -> plane.position.set(district.x, -0.2, district.z + 2);
content = content.replace("plane.position.set(district.x, 0.02, district.z + 2);", "plane.position.set(district.x, -0.2, district.z + 2);")

# 3. Increase PR Road Visibility
# const baseOpacity = clamp(0.1 + flowStrength * 0.16, 0.12, 0.28);
content = content.replace(
    "const baseOpacity = clamp(0.1 + flowStrength * 0.16, 0.12, 0.28);",
    "const baseOpacity = clamp(0.25 + flowStrength * 0.4, 0.3, 0.8);"
)
# const radius = clamp(0.035 + flowStrength * 0.07, 0.045, 0.115);
content = content.replace(
    "const radius = clamp(0.035 + flowStrength * 0.07, 0.045, 0.115);",
    "const radius = clamp(0.08 + flowStrength * 0.15, 0.1, 0.25);"
)
# speed: 0.055 + flowStrength * 0.065 + (source.repo.stars % 7) * 0.003,
content = content.replace(
    "speed: 0.055 + flowStrength * 0.065 + (source.repo.stars % 7) * 0.003,",
    "speed: 0.15 + flowStrength * 0.15 + (source.repo.stars % 7) * 0.01,"
)
# const packetCount = Math.max(1, Math.min(packetBudget, Math.round(1 + flowStrength * 3.2 + Math.min(2, source.repo.prs.length))));
content = content.replace(
    "const packetCount = Math.max(1, Math.min(packetBudget, Math.round(1 + flowStrength * 3.2 + Math.min(2, source.repo.prs.length))));",
    "const packetCount = Math.max(3, Math.min(packetBudget, Math.round(4 + flowStrength * 8.0 + Math.min(5, source.repo.prs.length))));"
)

# 4. Fix highStarTrending Algorithm
# const highStarTrending = useMemo(() => {
#    return [...effectiveRepos].sort((a, b) => b.stars - a.stars).slice(0, 3);
#  }, [effectiveRepos]);
old_trending = """  const highStarTrending = useMemo(() => {
    return [...effectiveRepos].sort((a, b) => b.stars - a.stars).slice(0, 3);
  }, [effectiveRepos]);"""
new_trending = """  const highStarTrending = useMemo(() => {
    // Sort by recent velocity: commitsPerWeek heavily weighted, plus base stars
    return [...effectiveRepos].sort((a, b) => (b.commitsPerWeek * 100 + b.stars * 0.01) - (a.commitsPerWeek * 100 + a.stars * 0.01)).slice(0, 3);
  }, [effectiveRepos]);"""
content = content.replace(old_trending, new_trending)

# 5. Make trending repos clickable
old_render_trending = """              {highStarTrending.map((repo) => (
                <div key={repo.id} className="dropdown-item">"""
new_render_trending = """              {highStarTrending.map((repo) => (
                <div key={repo.id} className="dropdown-item" onClick={() => focusRepo(repo)} style={{ cursor: 'pointer' }}>"""
content = content.replace(old_render_trending, new_render_trending)

# 6. Fix response time algorithm in buildRepoFromGraphNode
old_response = "responseHours: commitsPerWeekFromDate(node.pushedAt ?? node.updatedAt) >= 12 ? 18 : 36,"
new_response = """responseHours: (() => {
      const commits = commitsPerWeekFromDate(node.pushedAt ?? node.updatedAt);
      const issues = node.openIssues ?? 0;
      let hours = 72;
      if (commits > 30) hours = 4;
      else if (commits > 15) hours = 12;
      else if (commits > 5) hours = 24;
      else if (commits > 0) hours = 48;
      if (issues > 500) hours *= 1.5;
      return Math.max(1, Math.round(hours));
    })(),"""
content = content.replace(old_response, new_response)

# Also fix response time for handleImport (line 469)
old_response_import = "responseHours: daysSincePush <= 7 ? 18 : daysSincePush <= 30 ? 36 : 72,"
new_response_import = """responseHours: (() => {
      let hours = 72;
      if (commitsPerWeek > 30) hours = 4;
      else if (commitsPerWeek > 15) hours = 12;
      else if (commitsPerWeek > 5) hours = 24;
      else if (commitsPerWeek > 0) hours = 48;
      if (openIssues > 500) hours *= 1.5;
      return Math.max(1, Math.round(hours));
    })(),"""
content = content.replace(old_response_import, new_response_import)

with open(FILE_PATH, "w") as f:
    f.write(content)

print("District spacing, algorithms, and road animation logic updated.")
