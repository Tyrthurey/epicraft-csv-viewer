// app/layout.tsx
import './globals.css';
import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Epicraft Mod Explorer',
    description: 'Live mod compatibility tracking for the Epicraft community.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
        <body className="antialiased">
            <ThemeToggle />
            {children}
        </body>
        </html>
    );
}