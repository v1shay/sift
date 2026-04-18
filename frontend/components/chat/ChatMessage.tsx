import { cn } from "@/lib/utils";

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={cn("rounded-lg px-3 py-2 text-sm", role === "user" ? "ml-8 bg-ink text-white" : "mr-8 bg-zinc-100 text-ink")}>
      {content}
    </div>
  );
}

