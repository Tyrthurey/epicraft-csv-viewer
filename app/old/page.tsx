// app/page.tsx
import React from 'react';
import Link from 'next/link';
import TableClient from '@/components/TableClient';
import {fetchExcelData} from '@/lib/excel';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const excelUrl = process.env.DOCUMENT_URL;
    if (!excelUrl) {
        return (
            <main className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-4">Epicraft Mod Explorer</h1>
                <p className="text-red-500 font-medium">Missing environment variable DOCUMENT_URL in .env.local</p>
            </main>
        );
    }

    const {data: sheets, error} = await fetchExcelData(excelUrl);

    if (error) {
        return (
            <main
                className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                <div
                    className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl p-10 border border-rose-200 dark:border-rose-900/50 shadow-lg text-center">
                    <div className="text-5xl mb-5">⚠️</div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Connection Failed</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">We couldn&apos;t reach the
                        compatibility sheet. This is usually due to a private link or a temporary connection issue.</p>

                    <div
                        className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/50 text-left mb-6">
                        <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-300 mb-3">Technical
                            Details</h2>
                        <code
                            className="text-xs text-rose-700 dark:text-rose-400 break-all bg-white dark:bg-gray-900 p-2.5 rounded-lg block border border-rose-100 dark:border-rose-800 mb-5">{error}</code>

                        <h3 className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-2">Troubleshooting:</h3>
                        <ul className="space-y-2 text-sm text-rose-700 dark:text-rose-400">
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5">•</span>
                                <span>Verify the Google Sheets link is <strong>&quot;Published to the web&quot;</strong> specifically as an <strong>XLSX</strong> file.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5">•</span>
                                <span>Ensure &quot;Anyone with the link&quot; permissions are set if using a direct OneDrive link.</span>
                            </li>
                        </ul>
                    </div>

                    <Link
                        href="/public"
                        className="w-full py-3.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-md hover:shadow-orange-200/50 transition-all active:scale-95 text-center block"
                    >
                        Try to reconnect
                    </Link>
                </div>
            </main>
        );
    }

    if (!sheets || sheets.length === 0) {
        return (
            <main
                className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                <div
                    className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl p-10 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                    <div className="text-5xl mb-5">📦</div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">No Sheets Found</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">The connected document
                        doesn&apos;t seem to contain any valid mod sheets or category tabs.</p>
                    <Link
                        href="/public"
                        className="w-full py-3.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-md hover:shadow-orange-200/50 transition-all active:scale-95 text-center block"
                    >
                        Refresh data
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main
            className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900 dark:selection:text-orange-100">
            <div
                className="mx-auto px-4 py-12 w-full max-w-7xl min-[1921px]:max-w-[90rem] min-[2500px]:max-w-[110rem] min-[3200px]:max-w-[130rem]">
                <header className="mb-16 text-center">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-5">
                        Epicraft <span
                        className="bg-linear-to-r from-orange-600 to-rose-600 dark:from-orange-500 dark:to-rose-500 bg-clip-text text-transparent">Mod Explorer</span>
                    </h1>
                    <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        This is the old page that references the spreadsheet directly.
                    </p>
                </header>

                <section className="animate-slide-up">
                    <TableClient sheets={sheets}/>
                </section>

                <footer className="mt-24 pt-10 border-t border-gray-200/50 dark:border-gray-700/50 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <a
                            href="https://docs.google.com/spreadsheets/d/e/2PACX-1vRz6SXO_bxSPz7xeH7w8YEqoP5NAWMrcQ2McyjEdd8g40SZ-dufQZdAkR8a1bI5Y3gyjgTN_Er-QWmi/pub"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Connected to live spreadsheet
                        </a>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                            Powered by <span
                            className="font-medium text-gray-700 dark:text-gray-300">Next.js</span> & <span
                            className="font-medium text-gray-700 dark:text-gray-300">Google Sheets</span>.
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto flex items-center justify-center gap-2">
                            <span>Made by <span
                                className="font-medium text-gray-700 dark:text-gray-300">Tyr</span></span>
                            <span>-</span>
                            <a
                                href="https://github.com/Tyrthurey/epicraft-csv-viewer"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fillRule="evenodd"
                                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                                          clipRule="evenodd"/>
                                </svg>
                                GitHub
                            </a>

                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                            Spreadsheet maintained by <span
                            className="font-medium text-gray-700 dark:text-gray-300">@jurkomsk</span> and <span
                            className="font-medium text-gray-700 dark:text-gray-300">@cobwebblocks</span>.
                        </p>

                    </div>
                </footer>
            </div>
        </main>
    );
}
