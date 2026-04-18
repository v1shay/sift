import { ChatShell } from "@/components/chat/ChatShell";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectGrid } from "@/components/projects/ProjectGrid";

export default function HomePage() {
  return (
    <AppShell>
      <main className="grid min-h-screen gap-6 p-6 lg:grid-cols-[420px_1fr]">
        <ChatShell />
        <ProjectGrid />
      </main>
    </AppShell>
  );
}

