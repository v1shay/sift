import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-md border border-zinc-200 bg-white p-1", className)} {...props} />;
}

