import os
import json
import instructor
import httpx
from dotenv import load_dotenv
from openai import OpenAI
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

# Pydantic model for LLM structured output
class SearchFilters(BaseModel):
    topics: List[str] = Field(default_factory=list, description="GitHub topics or exact tags to filter by")
    languages: List[str] = Field(default_factory=list, description="Programming languages explicitly mentioned")
    is_beginner_friendly: bool = Field(default=False, description="Whether the user asked for beginner-friendly, starter, or good-first-issue projects")
    min_stars: Optional[int] = Field(default=None, description="Minimum star count implied by the user (e.g., popular > 500)")
    semantic_intent: str = Field(description="A concise summary of what the user is really looking for, acting as a fuzzy text search fallback")


class LLMConfigurationError(RuntimeError):
    pass


class LLMQueryError(RuntimeError):
    pass


class LLMQueryParser:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "openrouter").lower()
        api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("OLLAMA_MODEL" if self.provider == "ollama" else "OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
        self.allow_local_fallback = os.getenv("ALLOW_LOCAL_QUERY_FALLBACK", "").lower() == "true"
        self.client = None

        if self.provider == "ollama":
            if not self.model or self.model == "openai/gpt-4o-mini":
                self.model = "gemma4:26b"
            return

        if not api_key:
            if self.allow_local_fallback:
                print("WARNING: OPENROUTER_API_KEY not set. Using explicit local fallback parser.")
                return
            raise LLMConfigurationError(
                "OPENROUTER_API_KEY is not configured. Add it to backend/.env to enable LLM-backed search."
            )

        if api_key.startswith("sk-over-"):
            raise LLMConfigurationError(
                "OPENROUTER_API_KEY appears malformed. Rotate the exposed key and configure a fresh OpenRouter key."
            )

        if not api_key.startswith("sk-or-") and not api_key.startswith("sk-ant-"):
            print("WARNING: LLM API key prefix is unfamiliar; attempting OpenRouter-compatible request anyway.")

        self.client = instructor.from_openai(OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Sift",
            },
        ))
        
    def parse_query(self, user_query: str) -> SearchFilters:
        """Parses a natural language query into formal search filters."""
        if self.provider == "ollama":
            try:
                return self._parse_query_with_ollama(user_query)
            except Exception as exc:
                if self.allow_local_fallback:
                    print(f"Ollama query parsing failed, using explicit local fallback parser instead: {exc}")
                    return self._parse_query_locally(user_query)
                raise LLMQueryError(f"Ollama query parsing failed: {exc}") from exc

        if self.client is None:
            return self._parse_query_locally(user_query)

        try:
            return self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a specialized query analyzer for an open source repository graph database. "
                            "Extract structured filters from natural language requests. Map broad phrases to useful GitHub topics: "
                            "front end design -> react, ui, design-system, component; "
                            "machine learning -> machine-learning, ai, pytorch, tensorflow; "
                            "LLM work -> llm, rag, agents, prompt-engineering, transformer; "
                            "devops -> docker, kubernetes, ci, observability. "
                            "Use exact programming languages when requested. Infer min_stars only when the user asks for popular, large, or highly starred projects."
                        )
                    },
                    {
                        "role": "user",
                        "content": f"Extract filters from this request: '{user_query}'"
                    }
                ],
                response_model=SearchFilters,
            )
        except Exception as exc:
            if self.allow_local_fallback:
                print(f"LLM query parsing failed, using explicit local fallback parser instead: {exc}")
                return self._parse_query_locally(user_query)
            raise LLMQueryError(f"LLM query parsing failed: {exc}") from exc

    def _parse_query_with_ollama(self, user_query: str) -> SearchFilters:
        prompt = (
            "You extract structured filters for a local open source repository graph.\n"
            "Return ONLY valid JSON with this exact shape:\n"
            "{\n"
            '  "topics": ["topic-name"],\n'
            '  "languages": ["Python"],\n'
            '  "is_beginner_friendly": false,\n'
            '  "min_stars": null,\n'
            '  "semantic_intent": "short user intent summary"\n'
            "}\n\n"
            "Mapping hints:\n"
            "- front end design: react, ui, design-system, component, css, tailwind, storybook\n"
            "- machine learning: machine-learning, ai, pytorch, tensorflow\n"
            "- LLM work: llm, rag, agents, prompt-engineering, transformer\n"
            "- devops: docker, kubernetes, ci, observability\n"
            "- popular/highly starred: min_stars 1000 or higher\n"
            "- beginner/good first issue/easy: is_beginner_friendly true\n\n"
            f"User request: {user_query}"
        )

        response = httpx.post(
            f"{self.ollama_url.rstrip('/')}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0,
                    "num_predict": 512,
                },
            },
            timeout=90,
        )
        response.raise_for_status()
        raw_response = response.json().get("response", "{}")
        payload = self._extract_json(raw_response)
        return SearchFilters.model_validate(payload)

    def _extract_json(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(text[start:end + 1])

    def _parse_query_locally(self, user_query: str) -> SearchFilters:
        """Small no-network fallback so chat search still works during local dev."""
        normalized = user_query.lower()
        known_languages = [
            "python",
            "typescript",
            "javascript",
            "rust",
            "go",
            "java",
            "c++",
            "c#",
            "ruby",
            "php",
            "swift",
            "kotlin",
        ]
        languages = [
            language.title() if language not in {"c++", "c#"} else language
            for language in known_languages
            if language in normalized
        ]

        min_stars = None
        if any(term in normalized for term in ["popular", "lots of stars", "high stars", "starred"]):
            min_stars = 1000
        if any(term in normalized for term in ["beginner", "good first", "starter", "easy"]):
            is_beginner_friendly = True
        else:
            is_beginner_friendly = False

        topic_terms = [
            "machine-learning",
            "ai",
            "cli",
            "web",
            "react",
            "devops",
            "database",
            "security",
            "game",
            "mobile",
        ]
        topics = [topic for topic in topic_terms if topic.replace("-", " ") in normalized or topic in normalized]

        return SearchFilters(
            topics=topics,
            languages=languages,
            is_beginner_friendly=is_beginner_friendly,
            min_stars=min_stars,
            semantic_intent=user_query.strip() or "Explore open source repositories",
        )
