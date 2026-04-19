'use client';

import React from 'react';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const isUser = role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-violet-600/20 text-violet-400'
            : 'bg-emerald-600/20 text-emerald-400'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600/15 text-zinc-100 rounded-br-md'
            : 'bg-zinc-800/80 text-zinc-200 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p>{content}</p>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0"
            dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Minimal markdown → HTML conversion for assistant messages.
 * Handles bold, italic, headers, links, and lists.
 */
function simpleMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:text-violet-300 underline">$1</a>')
    // Unordered list items
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default ChatMessage;
