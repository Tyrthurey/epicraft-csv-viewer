import React from 'react';

export default function Loading() {
    return (
        <div
            className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4 overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(8)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute text-2xl opacity-10 dark:opacity-5 animate-pulse"
                        style={{
                            left: `${7 + (i * 13) % 86}%`,
                            top: `${7 + (i * 24.2) % 86}%`,
                            animationDelay: `${((i * 3) % 8) * 0.6}s`,
                            animationDuration: `${2.5 + ((i * 7) % 5) * 0.5}s`
                        }}
                    >
                        {['📦', '⚙️', '🛠️', ' ', '🔍', '💎', '🚀', '🧩', '🧪'][i]}
                    </div>
                ))}

                {/* Large Background Glows */}
                <div
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-400/10 dark:bg-orange-600/5 rounded-full blur-[120px] animate-pulse"></div>
                <div
                    className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-400/10 dark:bg-rose-600/5 rounded-full blur-[120px] animate-pulse [animation-delay:1s]"></div>
            </div>

            <div className="relative flex items-center justify-center">
                {/* Orbital System */}
                <div className="relative w-64 h-64 flex items-center justify-center">

                    {/* Outer Thin Ring - Slow */}
                    <div
                        className="absolute inset-0 border border-dashed border-orange-300/30 dark:border-orange-700/20 rounded-full animate-[spin_15s_linear_infinite]"></div>

                    {/* Glow Pulse */}
                    <div
                        className="absolute w-40 h-40 bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-2xl animate-pulse"></div>

                    {/* Main Spinning Ring (Multi-colored) */}
                    <div
                        className="absolute w-48 h-48 border-4 border-transparent border-t-orange-600 border-r-rose-500 rounded-full animate-spin"></div>

                    {/* Secondary Reverse Ring */}
                    <div
                        className="absolute w-40 h-40 border-4 border-transparent border-t-rose-500 border-l-orange-400 rounded-full animate-spin [animation-direction:reverse] [animation-duration:2.5s] opacity-70"></div>

                    {/* Inner Rapid Ring */}
                    <div
                        className="absolute w-32 h-32 border-2 border-transparent border-b-amber-400 rounded-full animate-spin [animation-duration:1s]"></div>

                    {/* Orbiting Particle */}
                    <div className="absolute w-full h-full animate-[spin_3s_linear_infinite]">
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.8)]"></div>
                    </div>

                    {/* Center Icon */}
                    <div
                        className="absolute flex flex-col items-center justify-center animate-bounce [animation-duration:2s]">
                        <span className="text-5xl drop-shadow-2xl">📦</span>
                    </div>
                </div>
            </div>

            {/* Typography Section */}
            <div className="mt-16 flex flex-col items-center gap-4 z-10">
                <div className="relative">
                    <h2 className="text-5xl font-black tracking-tighter text-center uppercase italic">
                        <span
                            className="bg-linear-to-r from-orange-600 via-rose-600 to-orange-600 dark:from-orange-500 dark:via-rose-500 dark:to-orange-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_2.5s_linear_infinite]">
                            Loading...
                        </span>
                    </h2>
                    {/* Animated Underline */}
                    <div
                        className="absolute -bottom-2 left-0 w-full h-1 bg-linear-to-r from-transparent via-orange-500 to-transparent scale-x-0 animate-[grow_2s_ease-in-out_infinite]"></div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.4em] ml-1">
                        Epicraft Mod Explorer
                    </p>

                    {/* Loading Status Bar */}
                    <div
                        className="w-48 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mt-2 border border-gray-100 dark:border-gray-900">
                        <div
                            className="h-full bg-linear-to-r from-orange-500 to-rose-500 w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
                    </div>
                </div>
            </div>

            {/* Custom Animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes grow {
                    0%, 100% { transform: scaleX(0); opacity: 0; }
                    50% { transform: scaleX(1); opacity: 1; }
                }
                @keyframes loading-bar {
                    0% { transform: translateX(-100%) scaleX(0.5); }
                    50% { transform: translateX(100%) scaleX(1.5); }
                    100% { transform: translateX(300%) scaleX(0.5); }
                }
            `
            }}/>
        </div>
    );
}
