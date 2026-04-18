import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // For now, we just return a hardcoded response to test the connection.
    return NextResponse.json({
      role: 'assistant',
      content: 'I am your AI assistant. I can help you find GitHub projects. Tell me what you are looking for!'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
