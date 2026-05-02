import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx


GITHUB_API_BASE = "https://api.github.com"


def parse_github_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


class GitHubPullRequestFetcher:
    def __init__(self) -> None:
        self.token = os.getenv("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    async def fetch_recent_pull_requests(
        self,
        full_name: str,
        days: int,
        per_page: int = 30,
    ) -> Dict[str, Any]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        url = f"{GITHUB_API_BASE}/repos/{full_name}/pulls"
        params = {
            "state": "all",
            "sort": "updated",
            "direction": "desc",
            "per_page": per_page,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            return self._unavailable(full_name, f"GitHub returned {exc.response.status_code}")
        except httpx.HTTPError as exc:
            return self._unavailable(full_name, str(exc))

        pull_requests = response.json()
        recent = []
        for item in pull_requests:
            updated_at = parse_github_datetime(item.get("updated_at"))
            created_at = parse_github_datetime(item.get("created_at"))
            closed_at = parse_github_datetime(item.get("closed_at"))
            merged_at = parse_github_datetime(item.get("merged_at"))
            activity_at = updated_at or created_at
            if activity_at and activity_at < since:
                continue

            state = item.get("state") or "unknown"
            if merged_at:
                state = "merged"

            recent.append(
                {
                    "number": item.get("number"),
                    "title": item.get("title") or "Untitled pull request",
                    "state": state,
                    "url": item.get("html_url"),
                    "author": (item.get("user") or {}).get("login"),
                    "createdAt": created_at.isoformat() if created_at else None,
                    "updatedAt": updated_at.isoformat() if updated_at else None,
                    "closedAt": closed_at.isoformat() if closed_at else None,
                    "mergedAt": merged_at.isoformat() if merged_at else None,
                }
            )

        return {
            "fullName": full_name,
            "available": True,
            "openCount": sum(1 for item in recent if item["state"] == "open"),
            "mergedCount": sum(1 for item in recent if item["state"] == "merged"),
            "closedCount": sum(1 for item in recent if item["state"] == "closed"),
            "recentPullRequests": recent[:8],
            "error": None,
        }

    def _unavailable(self, full_name: str, error: str) -> Dict[str, Any]:
        return {
            "fullName": full_name,
            "available": False,
            "openCount": 0,
            "mergedCount": 0,
            "closedCount": 0,
            "recentPullRequests": [],
            "error": error,
        }
