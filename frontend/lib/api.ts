import { ChatMessage, ChatResponse } from './types';

/**
 * Send a chat message to the graph API and get back the narrowed graph match.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
): Promise<any> {
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content;
    
  const response = await fetch('/api/py/graph-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: userMessage }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
