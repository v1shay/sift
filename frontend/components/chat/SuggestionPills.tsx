import { Badge } from "@/components/ui/badge";

const suggestions = ["Beginner TypeScript issues", "ML docs projects", "Good first issues in Python"];

export function SuggestionPills() {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <Badge key={suggestion}>{suggestion}</Badge>
      ))}
    </div>
  );
}

