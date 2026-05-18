import os
import time
import jwt
import httpx
from dotenv import load_dotenv

load_dotenv()

GITHUB_APP_ID = os.getenv("GITHUB_APP_ID")
GITHUB_PEM_PATH = os.getenv("GITHUB_PEM_PATH")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

def get_app_jwt() -> str:
    """Generates a JWT for the GitHub App."""
    if not GITHUB_APP_ID or not GITHUB_PEM_PATH:
        raise ValueError("Missing GITHUB_APP_ID or GITHUB_PEM_PATH")
    
    with open(GITHUB_PEM_PATH, "rb") as f:
        private_key = f.read()
    
    payload = {
        "iat": int(time.time()),
        "exp": int(time.time()) + (10 * 60),
        "iss": GITHUB_APP_ID
    }
    
    return jwt.encode(payload, private_key, algorithm="RS256")

async def get_installation_token(installation_id: int) -> str:
    """Gets an installation access token."""
    app_jwt = get_app_jwt()
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers=headers
        )
        response.raise_for_status()
        return response.json()["token"]

async def get_first_installation_token() -> str:
    """Helper to just get a token for the first installation (for background jobs)."""
    app_jwt = get_app_jwt()
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.github.com/app/installations", headers=headers)
        response.raise_for_status()
        installations = response.json()
        if not installations:
            raise ValueError("No installations found for this GitHub App.")
        
        return await get_installation_token(installations[0]["id"])
