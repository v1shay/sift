# Context
The user wants to create an AI-powered website for finding open source GitHub projects based on natural language input. The repository currently contains placeholder files (0 bytes) for a Next.js application.

# Objective
Implement a retrieval engine that takes natural language input, parses it using an LLM, and returns a list of matching GitHub projects.

# Implementation Plan

## Phase 1: Basic Chat API implementation ✅
- ~~Implement `frontend/app/api/chat/route.ts` to handle POST requests.~~
- ~~Integrate an LLM (e.g., via Anthropic SDK) to process the chat message.~~
- ~~For now, make the API return a hardcoded "mock" list of projects to verify the end-to-end flow.~~
- Chat UI components built: `ChatShell`, `ChatInput`, `ChatMessage`, `SuggestionPills`, `TypingIndicator`
- Client-side API helper: `lib/api.ts`

## Phase 2: GitHub API Integration ✅
- ~~Implement a service to fetch real project data from the GitHub Search API.~~ → `lib/github.ts`
- ~~Use the LLM to extract search parameters (language, topic, etc.) from the user's prompt.~~ → `lib/llm.ts`
- ~~Update the API route to use this service.~~ → `app/api/chat/route.ts` refactored
- Type definitions: `lib/types.ts`
- Constants & LLM prompts: `lib/constants.ts`
- Project display components: `ProjectCard`, `ProjectGrid`

## Phase 3: Semantic Search (RAG)
- Set up a vector database (e.g., a lightweight in-memory vector store or a managed service like Pinecone/Supabase).
- Implement an embedding pipeline (e.g., using OpenAI or Anthropic embeddings).
- Index GitHub project metadata into the vector database.
- Implement a retrieval step in the API route that performs a vector search based on the user's query.

## Phase 4: UI Enhancement
- Update `frontend/components/arg/ChatInput.tsx` and `ChatShell.tsx` to display the returned project cards.
- Implement the project detail view in `frontend/app/projects/[id]/page.tsx`.

# Verification Plan
- Verify that the chat API responds to requests.
- Verify that the LLM correctly extracts search parameters.
- Verify that the GitHub API returns real results.
- Verify that the vector search returns semantically relevant projects.
