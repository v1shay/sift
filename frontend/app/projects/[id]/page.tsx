interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">
          Project
        </p>
        <h1 className="mt-3 text-3xl font-bold">Repository {params.id}</h1>
        <p className="mt-4 text-zinc-400">
          Project detail pages are not wired up yet. Head back to the graph chat
          to explore matching repositories.
        </p>
      </div>
    </main>
  );
}
