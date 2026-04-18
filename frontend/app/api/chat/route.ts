import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sift.ai',
        'X-Title': 'Sift',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter Error:', data);
      return NextResponse.json({ error: data.error?.message || 'Openring error' }, { status: response.status });
    }

    const assistantMessage = data.choices[0].message;
    return NextResponse.json({
      role: 'assistant',
      content: assistantMessage.content,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
