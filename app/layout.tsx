// app/layout.tsx
import "./globals.css";
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ReloadButton from "@/components/ReloadButton";
import ViewToggle from "@/components/ViewToggle";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "EPICRAFT Client-side Mod Explorer",
  description:
    "Curated list of client-side mods for the Epicraft community that greatly improves the modpack experience.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="fixed top-4 right-4 z-50 flex gap-2 items-center">
          <ViewToggle />
          <ReloadButton />
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
