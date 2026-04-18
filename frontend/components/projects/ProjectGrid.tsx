import { ProjectCard } from "./ProjectCard";

const demoProjects = [
  {
    name: "storybookjs/storybook",
    description: "Frontend workshop for UI development and documentation.",
    language: "TypeScript",
    score: 92,
    contributors: 2500,
    health: 88
  },
  {
    name: "fastapi/fastapi",
    description: "Modern Python web framework with clear contribution paths.",
    language: "Python",
    score: 86,
    contributors: 780,
    health: 91
  }
];

export function ProjectGrid() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Recommended projects</h2>
        <p className="mt-2 text-sm text-zinc-600">Ranked by fit, activity, health, and contribution readiness.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {demoProjects.map((project) => (
          <ProjectCard key={project.name} {...project} />
        ))}
      </div>
    </section>
  );
}

