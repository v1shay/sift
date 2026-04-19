'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import SuggestionPills from './SuggestionPills';
import TypingIndicator from './TypingIndicator';
import { sendChatMessage } from '@/lib/api';
import { ChatMessage as ChatMessageType, GitHubProject } from '@/lib/types';

// Dynamic import bypasses Next.js Server Side Rendering (SSR) so canvas can access the window object!
const RepoGraph = dynamic(() => import('../graph/RepoGraph'), { ssr: false });

interface DisplayMessage extends ChatMessageType {
  projects?: GitHubProject[];
  searchParams?: any;
}

function ChatShell() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMessage: DisplayMessage = { role: 'user', content: text };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        if (/^(hi|hello|hey|yo|sup)[!. ]*$/i.test(text.trim())) {
          const greetingMessage: DisplayMessage = {
            role: 'assistant',
            content:
              'Hey! I can search the local repository graph for things like "popular Rust repos", "React component libraries", or "beginner-friendly Python projects."',
          };
          setMessages((prev) => [...prev, greetingMessage]);
          setHighlightedNodes([]);
          return;
        }

        const apiMessages = newMessages.map(({ role, content }) => ({ role, content }));
        const responseData = await sendChatMessage(apiMessages);
        
        // Response format is { data: { projects: [...], filters: {...} } } based on our python proxy return
        const clusteredProjects = responseData.data?.projects || [];
        const filters = responseData.data?.filters || {};
        
        let summaryMessage = `I applied your filters!\n\n**Semantic Match:** ${filters.semantic_intent}\n\n`;
        if (clusteredProjects.length === 0) {
           summaryMessage += "No repositories found matching this cluster.";
           setHighlightedNodes([]); // Clear highlight
        } else {
           summaryMessage += `I highlighted a cluster of **${clusteredProjects.length}** relevant repositories in the graph behind me.`;
           // Map database integers to the exact string node IDs we served in /api/py/graph-full
           setHighlightedNodes(clusteredProjects.map((p: any) => `repo_${p.id}`));
        }

        const assistantMessage: DisplayMessage = {
          role: 'assistant',
          content: summaryMessage,
          projects: clusteredProjects,
          searchParams: filters
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error: any) {
        const errorMessage: DisplayMessage = {
          role: 'assistant',
          content: `Something went wrong interacting with the graph backend: ${error.message}.`,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setHighlightedNodes([]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages],
  );

  const handleSuggestionClick = useCallback((suggestion: string) => { handleSend(suggestion); }, [handleSend]);
  const isEmpty = messages.length === 0;

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden">
        
       {/* Layer 1: the 2D interactive Force Graph Background */}
       <RepoGraph highlightedNodeIds={highlightedNodes} />
       
       {/* Layer 2: The Chat Interface (Glassmorphism Floating Frame) */}
       <div className="absolute top-0 right-0 w-full md:w-[400px] h-full bg-zinc-900/60 backdrop-blur-xl border-l border-zinc-800/80 shadow-2xl flex flex-col p-4 z-10">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scroll-smooth pt-10">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                <p className="text-sm font-semibold text-violet-400 mb-2">GRAPH LOADED</p>
                <p className="text-sm text-zinc-400 mb-6 px-4">
                  The repositories are mapped locally. Describe a cluster of open source projects you want to zoom into.
                </p>
                <SuggestionPills onSelect={handleSuggestionClick} />
              </div>
            )}

            {messages.map((msg, i) => (
              <React.Fragment key={i}>
                <ChatMessage role={msg.role} content={msg.content} />
              </React.Fragment>
            ))}

            {isLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 flex-shrink-0">
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>
       </div>
    </div>
  );
}

export default ChatShell;
