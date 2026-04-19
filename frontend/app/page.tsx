'use client';

import React, { useState } from 'react';
import ChatShell from '@/components/chat/ChatShell';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-center">Sift: Find your next Open Source project</h1>
        <ChatShell />
      </div>>
    </main>
  );
}
