import { Badge } from "@/components/ui/badge";

type MatchScoreBadgeProps = {
  score: number;
};

export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  return <Badge className="bg-moss text-white">{score}% match</Badge>;
}

