import { Card } from "@/components/ui/card";
import { ContributorBadge } from "./ContributorBadge";
import { MatchScoreBadge } from "./MatchScoreBadge";
import { RepoHealthBar } from "./RepoHealthBar";

type ProjectCardProps = {
  name: string;
  description: string;
  language: string;
  score: number;
  contributors: number;
  health: number;
};

export function ProjectCard({ name, description, language, score, contributors, health }: ProjectCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{name}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        <MatchScoreBadge score={score} />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <ContributorBadge count={contributors} />
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium">{language}</span>
      </div>
      <RepoHealthBar health={health} />
    </Card>
  );
}

