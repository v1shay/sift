'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  return (
    <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-colors focus-within:border-violet-500/50">
      <textarea
        ref={textareaRef}
        id="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder="e.g. Find me a Rust CLI tool for file management..."
        rows={1}
        className="flex-1 resize-none bg-transparent text-zinc-100 placeholder-zinc-500 outline-none text-sm leading-relaxed max-h-40"
      />
      <button
        id="chat-send-button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Send size={16} />
      </button>
    </div>
  );
};

export default ChatInput;
