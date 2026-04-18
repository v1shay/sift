import { Badge } from "@/components/ui/badge";

type ContributorBadgeProps = {
  count: number;
};

export function ContributorBadge({ count }: ContributorBadgeProps) {
  return <Badge>{count} contributors</Badge>;
}

