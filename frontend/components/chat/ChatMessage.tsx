'use client';

import React, { ReactNode } from 'react';
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
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
            {renderMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  );
};

function isSafeHref(href: string) {
  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{match[2]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={`${keyPrefix}-em-${match.index}`}>{match[4]}</em>);
    } else if (match[6] && match[7]) {
      const href = match[7];
      if (isSafeHref(href)) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-violet-400 hover:text-violet-300 underline"
          >
            {match[6]}
          </a>,
        );
      } else {
        nodes.push(match[6]);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function flushList(items: string[], blockKey: string, blocks: ReactNode[]) {
  if (!items.length) return;
  blocks.push(
    <ul key={blockKey}>
      {items.map((item, index) => (
        <li key={`${blockKey}-item-${index}`}>{renderInline(item, `${blockKey}-${index}`)}</li>
      ))}
    </ul>,
  );
  items.length = 0;
}

/**
 * Minimal safe markdown renderer for assistant messages.
 * React escapes text nodes, and links are restricted to http/https.
 */
function renderMarkdown(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(listItems, `list-${index}`, blocks);
      return;
    }

    const listMatch = /^[-•]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList(listItems, `list-${index}`, blocks);

    if (trimmed.startsWith('### ')) {
      blocks.push(<h3 key={`h3-${index}`}>{renderInline(trimmed.slice(4), `h3-${index}`)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      blocks.push(<h2 key={`h2-${index}`}>{renderInline(trimmed.slice(3), `h2-${index}`)}</h2>);
    } else if (trimmed.startsWith('# ')) {
      blocks.push(<h1 key={`h1-${index}`}>{renderInline(trimmed.slice(2), `h1-${index}`)}</h1>);
    } else {
      blocks.push(<p key={`p-${index}`}>{renderInline(trimmed, `p-${index}`)}</p>);
    }
  });

  flushList(listItems, 'list-final', blocks);
  return blocks;
}

export default ChatMessage;
