'use client';

import React from 'react';
import { Star, GitFork, CircleDot, ExternalLink } from 'lucide-react';
import { GitHubProject } from '@/lib/types';

interface ProjectCardProps {
  project: GitHubProject;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const formatCount = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      id={`project-card-${project.id}`}
      className="group block rounded-xl border border-zinc-700/40 bg-zinc-900/60 backdrop-blur-sm p-4 transition-all duration-200 hover:border-violet-500/40 hover:bg-zinc-800/70 hover:shadow-lg hover:shadow-violet-500/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={project.owner.avatarUrl}
            alt={project.owner.login}
            className="w-6 h-6 rounded-full flex-shrink-0"
          />
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {project.fullName}
          </span>
        </div>
        <ExternalLink
          size={14}
          className="flex-shrink-0 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Topics */}
      {project.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {project.topics.slice(0, 4).map((topic) => (
            <span
              key={topic}
              className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-medium"
            >
              {topic}
            </span>
          ))}
          {project.topics.length > 4 && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400 text-[10px]">
              +{project.topics.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        {project.language && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {project.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star size={11} />
          {formatCount(project.stars)}
        </span>
        <span className="flex items-center gap-1">
          <GitFork size={11} />
          {formatCount(project.forks)}
        </span>
        <span className="flex items-center gap-1">
          <CircleDot size={11} />
          {formatCount(project.openIssues)}
        </span>
        <span className="ml-auto text-zinc-600">
          updated {timeAgo(project.pushedAt)}
        </span>
      </div>
    </a>
  );
};

export default ProjectCard;
