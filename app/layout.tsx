// app/layout.tsx
import './globals.css';
import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import ReloadButton from '@/components/ReloadButton';
import ViewToggle from '@/components/ViewToggle';
import {Metadata} from "next";

export const metadata: Metadata = {
    title: 'Epicraft Mod Explorer',
    description: 'Live mod compatibility tracking for the Epicraft community.',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
        <body className="antialiased">
        <div className="fixed top-4 right-4 z-50 flex gap-2 items-center">
            <ViewToggle/>
            <ReloadButton/>
            <ThemeToggle/>
        </div>
        {children}
        </body>
        </html>
    );
}