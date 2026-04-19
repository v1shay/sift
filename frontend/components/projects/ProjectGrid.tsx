'use client';

import React from 'react';
import ProjectCard from './ProjectCard';
import { GitHubProject } from '@/lib/types';

interface ProjectGridProps {
  projects: GitHubProject[];
}

const ProjectGrid: React.FC<ProjectGridProps> = ({ projects }) => {
  if (projects.length === 0) return null;

  return (
    <div className="my-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};

export default ProjectGrid;
