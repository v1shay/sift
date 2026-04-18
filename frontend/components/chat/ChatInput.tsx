"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatInputProps = {
  onSend?: (message: string) => void;
};

export function ChatInput({ onSend }: ChatInputProps) {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    onSend?.(message.trim());
    setMessage("");
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what you want to work on" />
      <Button aria-label="Send message" className="w-10 px-0">
        <Send size={16} />
      </Button>
    </form>
  );
}

