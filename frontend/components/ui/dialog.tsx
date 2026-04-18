import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Dialog({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed inset-0 z-50 grid place-items-center bg-black/30 p-4", className)} {...props} />;
}

