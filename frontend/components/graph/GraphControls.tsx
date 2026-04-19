'use client';

import React from 'react';
import { Filter, Network, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  GraphFacets,
  GraphGroupBy,
  GraphOptions,
  GraphSortBy,
} from '@/lib/types';

interface GraphControlsProps {
  options: GraphOptions;
  facets: GraphFacets | null;
  selectedCluster: string | null;
  projectCount: number;
  clusterCount: number;
  onChange: (options: GraphOptions) => void;
  onReset: () => void;
}

const groupOptions: { value: GraphGroupBy; label: string }[] = [
  { value: 'domain', label: 'Domain' },
  { value: 'language', label: 'Language' },
  { value: 'topic', label: 'Topic' },
  { value: 'org', label: 'Org' },
  { value: 'stars', label: 'Stars' },
  { value: 'raw', label: 'Raw' },
];

const sortOptions: { value: GraphSortBy; label: string }[] = [
  { value: 'stars', label: 'Stars' },
  { value: 'forks', label: 'Forks' },
  { value: 'issues', label: 'Issues' },
  { value: 'updated', label: 'Updated' },
  { value: 'name', label: 'Name' },
];

const starOptions = [
  { value: 0, label: 'Any stars' },
  { value: 1000, label: '1k+' },
  { value: 10000, label: '10k+' },
  { value: 50000, label: '50k+' },
  { value: 100000, label: '100k+' },
];

function SelectField({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string | number;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-zinc-800 bg-zinc-950/90 px-2 text-sm text-zinc-100 outline-none transition focus:border-teal-400"
      >
        {children}
      </select>
    </label>
  );
}

export default function GraphControls({
  options,
  facets,
  selectedCluster,
  projectCount,
  clusterCount,
  onChange,
  onReset,
}: GraphControlsProps) {
  const update = (patch: Partial<GraphOptions>) => onChange({ ...options, ...patch });

  return (
    <div className="absolute left-4 top-4 z-20 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-zinc-800/90 bg-zinc-950/80 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-teal-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-zinc-100">Graph Explorer</p>
            <p className="text-xs text-zinc-500">
              {projectCount} repos · {clusterCount} clusters
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-50"
          title="Reset"
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="View"
          value={options.groupBy}
          onChange={(value) => update({ groupBy: value as GraphGroupBy })}
        >
          {groupOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Sort"
          value={options.sortBy}
          onChange={(value) => update({ sortBy: value as GraphSortBy })}
        >
          {sortOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Language"
          value={options.language || ''}
          onChange={(value) => update({ language: value || undefined })}
        >
          <option value="">All</option>
          {facets?.languages.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Topic"
          value={options.topic || ''}
          onChange={(value) => update({ topic: value || undefined })}
        >
          <option value="">All</option>
          {facets?.topics.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Org"
          value={options.org || ''}
          onChange={(value) => update({ org: value || undefined })}
        >
          <option value="">All</option>
          {facets?.orgs.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Stars"
          value={options.minStars}
          onChange={(value) => update({ minStars: Number(value) })}
        >
          {starOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Filter className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          <span>{selectedCluster || 'All clusters'}</span>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <SlidersHorizontal className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
          <input
            type="range"
            min={25}
            max={1000}
            step={25}
            value={options.limit}
            onChange={(event) => update({ limit: Number(event.target.value) })}
            className="w-24 accent-teal-400"
          />
          <span className="w-9 text-right">{options.limit}</span>
        </label>
      </div>
    </div>
  );
}
