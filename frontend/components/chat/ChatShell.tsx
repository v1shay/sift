'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import GraphControls from '../graph/GraphControls';
import { fetchGraphFacets, sendChatMessage } from '@/lib/api';
import {
  CityPreset,
  ChatMessage as ChatMessageType,
  GitHubProject,
  GraphFacets,
  GraphOptions,
  GraphViewMode,
} from '@/lib/types';

// Dynamic import bypasses Next.js Server Side Rendering (SSR) so canvas can access the window object!
const RepoGraph = dynamic(() => import('../graph/RepoGraph'), { ssr: false });
const RepoGraph3D = dynamic(() => import('../graph/RepoGraph3D'), { ssr: false });

const CITY_PRESETS_KEY = 'sift.cityPresets';

interface DisplayMessage extends ChatMessageType {
  projects?: GitHubProject[];
  searchParams?: any;
}

function ChatShell() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [graphStats, setGraphStats] = useState({ projectCount: 0, clusterCount: 0 });
  const [facets, setFacets] = useState<GraphFacets | null>(null);
  const [viewMode, setViewMode] = useState<GraphViewMode>('2d');
  const [cityPresets, setCityPresets] = useState<CityPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [graphOptions, setGraphOptions] = useState<GraphOptions>({
    groupBy: 'domain',
    sortBy: 'stars',
    limit: 250,
    minStars: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    fetchGraphFacets()
      .then(setFacets)
      .catch((error) => console.error('[Graph facets] Error:', error));
  }, []);

  useEffect(() => {
    try {
      const rawPresets = window.localStorage.getItem(CITY_PRESETS_KEY);
      if (rawPresets) {
        const parsed = JSON.parse(rawPresets);
        if (Array.isArray(parsed)) setCityPresets(parsed);
      }
    } catch (error) {
      console.error('[City presets] Could not load presets:', error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CITY_PRESETS_KEY, JSON.stringify(cityPresets));
    } catch (error) {
      console.error('[City presets] Could not save presets:', error);
    }
  }, [cityPresets]);

  const handleStatsChange = useCallback((stats: { projectCount: number; clusterCount: number }) => {
    setGraphStats(stats);
  }, []);

  const handleClusterSelect = useCallback((clusterName: string | null) => {
    setSelectedCluster(clusterName);
  }, []);

  const handleGraphReset = useCallback(() => {
    setGraphOptions({
      groupBy: 'domain',
      sortBy: 'stars',
      limit: 250,
      minStars: 0,
    });
    setSelectedCluster(null);
    setHighlightedNodes([]);
    setSelectedPresetId('');
  }, []);

  const handlePresetSave = useCallback(() => {
    const fallbackName = `${graphOptions.groupBy} city ${cityPresets.length + 1}`;
    const enteredName = window.prompt('Name this city preset', fallbackName);
    const name = enteredName?.trim();
    if (!name) return;

    const preset: CityPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      options: graphOptions,
      selectedCluster,
      createdAt: new Date().toISOString(),
    };

    setCityPresets((prev) => [preset, ...prev].slice(0, 12));
    setSelectedPresetId(preset.id);
  }, [cityPresets.length, graphOptions, selectedCluster]);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = cityPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setGraphOptions(preset.options);
    setSelectedCluster(preset.selectedCluster || null);
    setHighlightedNodes([]);
    setViewMode('3d');
  }, [cityPresets]);

  const handlePresetDelete = useCallback((presetId: string) => {
    setCityPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    if (selectedPresetId === presetId) {
      setSelectedPresetId('');
    }
  }, [selectedPresetId]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMessage: DisplayMessage = { role: 'user', content: text };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      try {
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

  const isEmpty = messages.length === 0;

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden">
        
       {viewMode === '2d' ? (
        <RepoGraph
          highlightedNodeIds={highlightedNodes}
          options={graphOptions}
          onStatsChange={handleStatsChange}
          onClusterSelect={handleClusterSelect}
        />
       ) : (
        <RepoGraph3D
          highlightedNodeIds={highlightedNodes}
          options={graphOptions}
          onStatsChange={handleStatsChange}
          onClusterSelect={handleClusterSelect}
        />
       )}

       <GraphControls
        options={graphOptions}
        facets={facets}
        selectedCluster={selectedCluster}
        viewMode={viewMode}
        presets={cityPresets}
        selectedPresetId={selectedPresetId}
        projectCount={graphStats.projectCount}
        clusterCount={graphStats.clusterCount}
        onChange={setGraphOptions}
        onViewModeChange={setViewMode}
        onPresetSelect={handlePresetSelect}
        onPresetSave={handlePresetSave}
        onPresetDelete={handlePresetDelete}
        onReset={handleGraphReset}
       />
       
       {/* Layer 2: The Chat Interface (Glassmorphism Floating Frame) */}
       <div className="absolute top-0 right-0 w-full md:w-[400px] h-full bg-zinc-900/60 backdrop-blur-xl border-l border-zinc-800/80 shadow-2xl flex flex-col p-4 z-10">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scroll-smooth pt-10">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                <p className="text-sm text-zinc-400 mb-6 px-4">
                  Describe a repository cluster to focus the graph.
                </p>
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
