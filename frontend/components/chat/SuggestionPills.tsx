'use client';

import React from 'react';

const SUGGESTIONS = [
  'Beginner-friendly Python projects for machine learning',
  'Popular Rust CLI tools with good first issues',
  'Active TypeScript web frameworks under 1000 stars',
  'Open source React component libraries',
  'Recently created Go projects for DevOps',
];

interface SuggestionPillsProps {
  onSelect: (suggestion: string) => void;
}

const SuggestionPills: React.FC<SuggestionPillsProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-xl">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-4 py-2 rounded-full border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-xs hover:bg-violet-600/15 hover:border-violet-500/40 hover:text-violet-300 transition-all duration-200"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default SuggestionPills;
