'use client';
import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

export default function ViewToggle() {
    const pathname = usePathname();
    const isOld = pathname === '/old';

    return (
        <Link
            href={isOld ? '/' : '/old'}
            className="p-2.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 group"
            aria-label={isOld ? "Go to modern view" : "Go to legacy view"}
        >
            {isOld ? (
                // Home/Modern Icon
                <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
            ) : (
                // Table/Legacy Icon
                <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
            )}
        </Link>
    );
}
