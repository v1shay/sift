'use client';

import dynamic from 'next/dynamic';

const ChatShell = dynamic(() => import('../components/chat/ChatShell'), { ssr: false });

export default function Home() {
  return (
    <main className="w-full h-full min-h-screen">
      <ChatShell />
    </main>
  );
}
