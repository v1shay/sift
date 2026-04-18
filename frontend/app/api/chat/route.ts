import { NextResponse } from 'next/server';
import Anthropic from 'anthropic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const assistantMessage = response.content[0];
    if (assistantMessage.type === 'text') {
      return NextResponse.json({
        role: 'assistant',
        content: assistantMessage.text,
      });
    } else {
      throw new Error('Unexpected response type from Claude');
    }
  } catch (error: any) {
    console.error('Anthropic API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
