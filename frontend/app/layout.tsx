import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sift × GitLab — Open Source Intelligence Map',
  description: 'A GitLab-sourced intelligence map for discovering open source projects and contribution opportunities.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
