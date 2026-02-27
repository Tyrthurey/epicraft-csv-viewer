'use client';
import React, {useMemo, useState} from 'react';

export interface UnifiedMod {
    name: string;
    description: string;
    iconUrl: string | null;
    modrinthId: string | null;
    curseforgeId?: number | null;
    links: string[];
    support: {
        forge1201: boolean | 'partial' | 'unsure';
        fabric1201: boolean | 'partial' | 'unsure';
        neoforge1211: boolean | 'partial' | 'unsure';
        fabric1211: boolean | 'partial' | 'unsure';
    };
    projectType?: string;
    isArchived?: boolean;
    downloads?: number;
    updated?: string;
    websiteUrl?: string | null;
    categories?: string[];
    subcategories?: Record<string, string>;
    notes?: { value: string; hyperlink?: string }[];
}

export interface CategoryInfo {
    name: string;
    subcategories: string[];
}

const SupportBadge = ({label, status, isCompact}: {
    label: string;
    status: boolean | 'partial' | 'unsure';
    isCompact?: boolean
}) => {
    let bgColor = 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 opacity-60';
    let icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"/>
        </svg>
    );

    if (status === true) {
        bgColor = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400';
        icon = (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"/>
            </svg>
        );
    } else if (status === 'partial') {
        bgColor = 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400';
        icon = (
            <span className="text-[10px] leading-none font-black">?</span>
        );
    } else if (status === 'unsure') {
        bgColor = 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400';
        icon = (
            <span className="text-[10px] leading-none font-black">!</span>
        );
    }

    const displayLabel = isCompact
        ? label.replace(/Neoforge/i, 'NEO').replace(/Forge/i, 'FOR').replace(/Fabric/i, 'FAB')
        : label;

    return (
        <div
            className={`inline-flex items-center gap-1.5 rounded-lg font-bold uppercase tracking-wider border shrink-0 transition-all ${
                isCompact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1.5 text-[10px]'
            } ${bgColor}`}>
            <span className="truncate">{displayLabel}</span>
            {icon}
        </div>
    );
};

function formatDownloads(n: number) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
}

export default function ModListClient({mods = [], availableCategories = []}: {
    mods: UnifiedMod[],
    availableCategories?: CategoryInfo[]
}) {
    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [isCompact, setIsCompact] = useState(false);

    const filters = [
        {id: 'forge1201', label: 'Forge 1.20.1'},
        {id: 'fabric1201', label: 'Fabric 1.20.1'},
        {id: 'neoforge1211', label: 'NeoForge 1.21.1'},
        {id: 'fabric1211', label: 'Fabric 1.21.1'},
    ];

    const filteredMods = useMemo(() => {
        let result = mods;

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(m =>
                m.name.toLowerCase().includes(s) ||
                m.description.toLowerCase().includes(s) ||
                (m.projectType && m.projectType.toLowerCase().includes(s)) ||
                (m.isArchived && 'archived'.includes(s))
            );
        }

        if (platformFilter) {
            result = result.filter(m => m.support[platformFilter as keyof typeof m.support]);
        }

        if (categoryFilter) {
            result = result.filter(m => m.categories?.includes(categoryFilter));
        }

        return result;
    }, [mods, search, platformFilter, categoryFilter]);

    const groupedMods = useMemo(() => {
        if (!categoryFilter) return [{name: null, mods: filteredMods}];

        const catInfo = availableCategories.find(c => c.name === categoryFilter);
        const subOrder = catInfo?.subcategories || [];

        const groups: Record<string, UnifiedMod[]> = {};
        const others: UnifiedMod[] = [];

        filteredMods.forEach(mod => {
            const sub = mod.subcategories?.[categoryFilter];
            if (sub) {
                if (!groups[sub]) groups[sub] = [];
                groups[sub].push(mod);
            } else {
                others.push(mod);
            }
        });

        const result = [];
        if (others.length > 0) {
            result.push({name: 'General', mods: others});
        }

        subOrder.forEach(sub => {
            if (groups[sub]) {
                result.push({name: sub, mods: groups[sub]});
            }
        });

        return result;
    }, [filteredMods, categoryFilter, availableCategories]);

    const renderClickableText = (val: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = val.split(urlRegex);
        return parts.map((part, index) =>
            urlRegex.test(part) ? (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-orange-600 dark:text-orange-400 decoration-orange-300 dark:decoration-orange-700 underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400 transition-colors break-all"
                >
                    {part}
                </a>
            ) : part
        );
    };

    return (
        <div className="space-y-8">
            {/* Category Filters - Now on Top, Full Width, and Bigger */}
            <div className="flex flex-wrap justify-center gap-2.5 mb-8">
                {availableCategories.map((cat) => (
                    <button
                        key={cat.name}
                        onClick={() => setCategoryFilter(categoryFilter === cat.name ? null : cat.name)}
                        className={`cursor-pointer px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                            categoryFilter === cat.name
                                ? 'bg-linear-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200/50 dark:shadow-orange-900/50'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                    <div className="relative flex-1 w-full">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Search ${mods.length} mods...`}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 dark:focus:border-orange-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-all duration-200"
                        />
                        <div className="absolute left-4 top-3.5 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsCompact(!isCompact)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium whitespace-nowrap w-full md:w-auto justify-center cursor-pointer ${
                            isCompact
                                ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 6h16M4 12h16m-7 6h7"/>
                        </svg>
                        Compact View
                    </button>
                </div>

                {/* Platform Filters */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setPlatformFilter(platformFilter === f.id ? null : f.id)}
                            className={`cursor-pointer px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 border w-full sm:w-auto ${
                                platformFilter === f.id
                                    ? 'bg-linear-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200/50 dark:shadow-orange-900/50'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-12">
                {groupedMods.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-8">
                        {group.name && (
                            <div className="flex items-center gap-4 my-10">
                                <div
                                    className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 px-4 py-2 bg-linear-to-r from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 rounded-full border border-orange-200 dark:border-orange-800 whitespace-nowrap">
                                    {group.name}
                                </h2>
                                <div
                                    className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                            </div>
                        )}

                        <div className={`grid gap-6 ${
                            isCompact
                                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        }`}>
                            {group.mods.map((mod, idx) => (
                                <div key={idx}
                                     className={`group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.15)] dark:hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.25)] hover:bg-orange-50/40 dark:hover:bg-gray-700/30 hover:border-orange-500/30 hover:ring-1 hover:ring-orange-500/20 transition-all duration-200 hover:-translate-y-1 flex flex-col h-full ${
                                         isCompact ? 'p-3' : 'p-6'
                                     }`}>
                                    <div className={`flex items-start gap-4 ${isCompact ? 'mb-2' : 'mb-4'}`}>
                                        {mod.iconUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={mod.iconUrl} alt={mod.name}
                                                 className={`${isCompact ? 'w-10 h-10 rounded-lg' : 'w-16 h-16 rounded-xl'} object-cover`}/>
                                        ) : (
                                            <div
                                                className={`${isCompact ? 'w-10 h-10 rounded-lg text-lg' : 'w-16 h-16 rounded-xl text-2xl'} bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center`}>
                                                📦
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h3 className={`${isCompact ? 'text-sm font-semibold' : 'text-lg font-bold'} text-gray-900 dark:text-white truncate flex-1 min-w-0`}>
                                                    {mod.modrinthId || mod.curseforgeId || mod.links.length > 0 || mod.websiteUrl ? (
                                                        <a
                                                            href={
                                                                mod.websiteUrl || (
                                                                    mod.modrinthId
                                                                        ? `https://modrinth.com/mod/${mod.modrinthId}`
                                                                        : mod.curseforgeId
                                                                            ? `https://www.curseforge.com/projects/${mod.curseforgeId}`
                                                                            : mod.links[0]
                                                                )
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                                                        >
                                                            {mod.name}
                                                        </a>
                                                    ) : (
                                                        mod.name
                                                    )}
                                                </h3>
                                                {!isCompact && mod.projectType && mod.projectType !== 'mod' && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                                                            {mod.projectType}
                                                    </span>
                                                )}
                                                {!isCompact && mod.isArchived && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                                                        Archived
                                                      </span>
                                                )}
                                            </div>
                                            {!isCompact && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-10 mt-1">
                                                    {mod.description || 'No description available.'}
                                                </p>
                                            )}

                                            {(mod.downloads !== undefined || mod.updated) && (
                                                <div
                                                    className={`flex items-center flex-wrap ${isCompact ? 'gap-2 mt-1' : 'gap-3 mt-2'}`}>
                                                    {mod.downloads !== undefined && (
                                                        <div
                                                            className={`inline-flex items-center gap-1 ${isCompact ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'} bg-orange-100/50 dark:bg-orange-900/30 border border-orange-200/50 dark:border-orange-800/50 rounded-md font-bold text-orange-700 dark:text-orange-400`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg"
                                                                 className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
                                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={2.5}
                                                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                                            </svg>
                                                            {formatDownloads(mod.downloads)}
                                                        </div>
                                                    )}
                                                    {mod.updated && (
                                                        <div
                                                            className={`flex items-center gap-1 ${isCompact ? 'text-[9px] font-medium' : 'text-[10px] font-semibold uppercase tracking-wider'} text-gray-500 dark:text-gray-400`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg"
                                                                 className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
                                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={2}
                                                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                            </svg>
                                                            {!isCompact && "Last updated: "}{formatDate(mod.updated)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        className={`mt-auto ${isCompact ? 'grid grid-cols-2 gap-1.5 mb-2' : 'flex flex-wrap gap-2'}`}>
                                        <SupportBadge label={isCompact ? 'FOR 1.20.1' : 'Forge 1.20.1'}
                                                      status={mod.support.forge1201} isCompact={isCompact}/>
                                        <SupportBadge label={isCompact ? 'FAB 1.20.1' : 'Fabric 1.20.1'}
                                                      status={mod.support.fabric1201} isCompact={isCompact}/>
                                        <SupportBadge label={isCompact ? 'NEO 1.21.1' : 'NeoForge 1.21.1'}
                                                      status={mod.support.neoforge1211} isCompact={isCompact}/>
                                        <SupportBadge label={isCompact ? 'FAB 1.21.1' : 'Fabric 1.21.1'}
                                                      status={mod.support.fabric1211} isCompact={isCompact}/>
                                    </div>

                                    {mod.notes && mod.notes.length > 0 && !isCompact && (
                                        <div
                                            className="mt-3 space-y-1.5 p-2 bg-amber-50/20 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                                            {mod.notes.map((n, i) => (
                                                <div key={i}
                                                     className="text-[10px] text-gray-600 dark:text-gray-400 italic leading-tight flex gap-1.5 items-start">
                                                    <span className="text-amber-500/70 shrink-0">📌</span>
                                                    <div className="min-w-0">
                                                        {n.hyperlink ? (
                                                            <a
                                                                href={n.hyperlink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="underline text-orange-600 dark:text-orange-400 decoration-orange-300 dark:decoration-orange-700 underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                                            >
                                                                {n.value}
                                                            </a>
                                                        ) : (
                                                            renderClickableText(n.value)
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div
                                        className={`mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-700 ${isCompact ? 'hidden' : ''}`}>
                                        {mod.links.filter(l => l.trim() !== '').map((link, lIdx) => {
                                            const isModrinth = link.includes('modrinth.com');
                                            const isCurseForge = link.includes('curseforge.com');
                                            let label = 'Link';
                                            if (isModrinth) label = 'Modrinth';
                                            else if (isCurseForge) label = 'CurseForge';
                                            else if (link.includes('google.com/search')) label = 'Search';

                                            return (
                                                <a
                                                    key={lIdx}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer"
                                                >
                                                    {label}
                                                </a>
                                            );
                                        })}
                                        {(mod.links.filter(l => l.trim() !== '').length === 0) && (
                                            <a
                                                href={`https://www.google.com/search?q=${encodeURIComponent(mod.name + ' minecraft mod')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer"
                                            >
                                                🔍 Search web
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {filteredMods.length === 0 && (
                <div
                    className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 mb-6">No mods found matching your search and
                        filters.</p>
                    {(search || platformFilter || categoryFilter) && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setPlatformFilter(null);
                                setCategoryFilter(null);
                            }}
                            className="px-6 py-2.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:shadow-md transition-all active:scale-95"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
