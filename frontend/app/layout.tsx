import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sift — Find Your Next Open Source Project',
  description: 'AI-powered search to discover the perfect open source projects to contribute to. Describe what you\'re looking for in natural language.',
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
