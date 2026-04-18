import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-moss", className)} {...props} />;
}

