import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Get the latest user message
    const userMessage = messages
      .filter((m: { role: string }) => m.role === 'user')
      .pop()?.content;

    if (!userMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 },
      );
    }

    console.log('[Next.js API] Proxying query to Python Graph DB:', userMessage);

    // Call Python FastAPI
    const backendRes = await fetch('http://localhost:8000/api/py/graph-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userMessage })
    });

    if (!backendRes.ok) {
        throw new Error(`Python backend failed with status ${backendRes.status}`);
    }

    const { data } = await backendRes.json();
    const projects = data.projects;
    const filters = data.filters;

    // We can use Next.js side to formulate a conversational response if we wanted, 
    // but for now let's just surface what the backend did!
    
    let summaryMessage = `I searched your local graph database!\n\n**Parsed Semantic Intent:** ${filters.semantic_intent}\n`;
    if (projects.length === 0) {
        summaryMessage += "\nI couldn't find any clustered nodes matching your exact description. Try broadening your parameters or run the ingestion script to backfill more repos!";
    } else {
        summaryMessage += `\nI narrowed the graph down to **${projects.length} matching repositories**. Explore the highlighted repository space in the graph.`;
    }

    return NextResponse.json({
      role: 'assistant',
      content: summaryMessage,
      projects: projects.map((p: any) => ({
          ...p, // Map local backend fields to generic ones used by the UI project cards
          fullName: p.full_name,
          openIssues: p.open_issues || 0,
          owner: {
              login: p.owner_login,
              avatarUrl: p.owner_avatar_url,
          }
      })),
      searchParameters: filters,
    });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request. Make sure the Python backend is running on port 8000!' },
      { status: 500 },
    );
  }
}
