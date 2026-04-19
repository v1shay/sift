import httpx
import os
import asyncio
from typing import List, Dict, Any

GITHUB_API_BASE = "https://api.github.com"

class GitHubRepoFetcher:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"
        else:
            print("WARNING: GITHUB_TOKEN not set, rate limits will be strictly enforced.")

    async def fetch_repos_by_query(self, query: str, per_page: int = 30) -> List[Dict[str, Any]]:
        """Fetch repositories matching a GitHub search query."""
        url = f"{GITHUB_API_BASE}/search/repositories"
        params = {
            "q": query,
            "per_page": per_page,
            "sort": "stars",
            "order": "desc"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])

    async def fetch_contributors(self, contributors_url: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch top contributors for a given repository URL."""
        if not contributors_url:
            return []
            
        params = {"per_page": limit}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(contributors_url, headers=self.headers, params=params)
                # handle cases where repo has no contributors or 403 due to size
                if response.status_code == 200:
                    return response.json()
                return []
            except Exception as e:
                print(f"Error fetching contributors from {contributors_url}: {e}")
                return []
