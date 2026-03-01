import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import {Providers} from "@/components/providers";
import {Toaster} from "@/components/ui/sonner";

import "./globals.css";
import "allotment/dist/style.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Sona – AI-Powered Code Workspace",
  description:
    "Spin up AI-powered code workspaces from GitHub or a prompt. Import repos, edit with an AI assistant, and export changes back to GitHub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${plexMono.variable} antialiased`}
        >
            <Providers>
                {children}
                <Toaster />
            </Providers>
        </body>
      </html>
  );
}
