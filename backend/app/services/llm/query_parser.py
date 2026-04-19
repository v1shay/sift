import os
import instructor
from pydantic import BaseModel, Field
from typing import List, Optional
from anthropic import Anthropic

# Pydantic model for LLM structured output
class SearchFilters(BaseModel):
    topics: List[str] = Field(default_factory=list, description="GitHub topics or exact tags to filter by")
    languages: List[str] = Field(default_factory=list, description="Programming languages explicitly mentioned")
    is_beginner_friendly: bool = Field(default=False, description="Whether the user asked for beginner-friendly, starter, or good-first-issue projects")
    min_stars: Optional[int] = Field(default=None, description="Minimum star count implied by the user (e.g., popular > 500)")
    semantic_intent: str = Field(description="A concise summary of what the user is really looking for, acting as a fuzzy text search fallback")

class LLMQueryParser:
    def __init__(self):
        # OpenRouter or Anthropic depending on env variables (we'll just use Anthropic standard interface here)
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("WARNING: ANTHROPIC_API_KEY not set. Query parsing will fail.")
        
        # We wrap standard Anthropic client with instructor for Pydantic schema enforcement
        # Since we use OpenRouter, we pass the custom base URL
        self.client = instructor.from_anthropic(Anthropic(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        ))
        
    def parse_query(self, user_query: str) -> SearchFilters:
        """Parses a natural language query into formal search filters."""
        return self.client.messages.create(
            # Using the latest fast model
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            messages=[
                {
                    "role": "system",
                    "content": "You are a specialized query analyzer for an open source repository graph database. Extract structured filters from user natural language requests."
                },
                {
                    "role": "user",
                    "content": f"Extract filters from this request: '{user_query}'"
                }
            ],
            response_model=SearchFilters,
        )
