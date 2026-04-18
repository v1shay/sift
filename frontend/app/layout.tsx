import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Source Finder",
  description: "Find open source projects that fit your skills and contribution style."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

