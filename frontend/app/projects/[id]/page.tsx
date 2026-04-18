type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <p className="text-sm uppercase tracking-wide text-moss">Project</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{id}</h1>
    </main>
  );
}

