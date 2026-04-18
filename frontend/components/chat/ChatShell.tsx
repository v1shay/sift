"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { SuggestionPills } from "./SuggestionPills";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const initialMessages: Message[] = [
  { role: "assistant", content: "Tell me your preferred language, difficulty, and topics. I will surface matching open source projects." }
];

export function ChatShell() {
  const [messages, setMessages] = useState(initialMessages);

  function handleSend(content: string) {
    setMessages((current) => [...current, { role: "user", content }]);
  }

  return (
    <section className="flex min-h-[640px] flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Open Source Finder</h1>
        <p className="mt-2 text-sm text-zinc-600">A chat-guided way to find contribution-ready repositories.</p>
      </div>
      <Card className="flex flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col gap-3">
          {messages.map((message, index) => (
            <ChatMessage key={`${message.role}-${index}`} {...message} />
          ))}
        </div>
        <SuggestionPills />
        <ChatInput onSend={handleSend} />
      </Card>
    </section>
  );
}

