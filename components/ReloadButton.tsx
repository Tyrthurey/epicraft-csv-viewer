'use client';
import React, { useState } from 'react';

export default function ReloadButton() {
    const [isReloading, setIsReloading] = useState(false);

    const handleReload = () => {
        setIsReloading(true);
        window.location.reload();
    };

    return (
        <button
            onClick={handleReload}
            disabled={isReloading}
            className="p-2.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 group disabled:opacity-50"
            aria-label="Reload data"
        >
            <svg 
                className={`w-5 h-5 text-gray-700 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors ${isReloading ? 'animate-spin-reverse' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        </button>
    );
}
