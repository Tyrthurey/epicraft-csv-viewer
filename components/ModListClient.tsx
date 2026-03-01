'use client';
import React, {useMemo, useState} from 'react';

export interface ModLink {
    url: string;
    label: string;
}

export interface UnifiedMod {
    name: string;
    description: string;
    iconUrl: string | null;
    modrinthId: string | null;
    curseforgeId?: number | null;
    links: ModLink[];
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

const TARGETS = [
    {label: 'Fabric 1.20.1', id: 'fabric_1_20_1'},
    {label: 'Forge 1.20.1', id: 'forge_1_20_1'},
    {label: 'Fabric 1.21.1', id: 'fabric_1_21_1'},
    {label: 'NeoForge 1.21.1', id: 'neoforge_1_21_1'},
];

const safeStorage = {
    getItem: (key: string) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem(key);
            }
        } catch (e) {
            console.warn('localStorage access failed:', e);
        }
        return null;
    },
    setItem: (key: string, value: string) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn('localStorage access failed:', e);
        }
    },
    removeItem: (key: string) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn('localStorage access failed:', e);
        }
    }
};

const ModDependencies = ({mod, modDeps, isCompact}: {
    mod: UnifiedMod;
    modDeps: Record<string, { required: { name: string, url: string }[], optional: { name: string, url: string }[] }>;
    isCompact: boolean;
}) => {
    const hasAnyDeps = TARGETS.some(t =>
        modDeps[t.id] && (modDeps[t.id].required.length > 0 || modDeps[t.id].optional.length > 0)
    );

    if (!hasAnyDeps) return null;

    // Identify versions supported according to spreadsheet
    const supportedTargets = TARGETS.filter(t => {
        const supportKey = t.id.replace(/_/g, '') as keyof typeof mod.support;
        return mod.support[supportKey] !== false;
    });

    // Identify versions that actually have dependency data
    const versionsWithDeps = TARGETS.filter(t =>
        modDeps[t.id] && (modDeps[t.id].required.length > 0 || modDeps[t.id].optional.length > 0)
    );

    // Find common required (must be in ALL supported targets)
    let commonRequired: { name: string; url: string }[] = [];
    if (supportedTargets.length > 0) {
        const firstTargetDeps = modDeps[supportedTargets[0].id]?.required || [];
        commonRequired = [...firstTargetDeps];
        for (let i = 1; i < supportedTargets.length; i++) {
            const currentDeps = modDeps[supportedTargets[i].id]?.required || [];
            commonRequired = commonRequired.filter(cd =>
                currentDeps.some(d => d.url === cd.url)
            );
        }
    }

    // Find common optional (must be in ALL supported targets)
    let commonOptional: { name: string; url: string }[] = [];
    if (supportedTargets.length > 0) {
        const firstTargetDeps = modDeps[supportedTargets[0].id]?.optional || [];
        commonOptional = [...firstTargetDeps];
        for (let i = 1; i < supportedTargets.length; i++) {
            const currentDeps = modDeps[supportedTargets[i].id]?.optional || [];
            commonOptional = commonOptional.filter(cd =>
                currentDeps.some(d => d.url === cd.url)
            );
        }
    }

    const anyRequired = commonRequired.length > 0 || versionsWithDeps.some(t => modDeps[t.id].required.length > 0);
    const anyOptional = commonOptional.length > 0 || versionsWithDeps.some(t => modDeps[t.id].optional.length > 0);

    // Version Specific Dependencies
    const specificDepsPerVersion = versionsWithDeps.map(target => ({
        target,
        required: modDeps[target.id].required.filter(d => !commonRequired.some(cd => cd.url === d.url)),
        optional: modDeps[target.id].optional.filter(d => !commonOptional.some(cd => cd.url === d.url))
    })).filter(sd => sd.required.length > 0 || sd.optional.length > 0);

    const groupedSpecific: {
        labels: string[],
        required: { name: string, url: string }[],
        optional: { name: string, url: string }[]
    }[] = [];
    specificDepsPerVersion.forEach(sd => {
        const match = groupedSpecific.find(g => {
            if (g.required.length !== sd.required.length || g.optional.length !== sd.optional.length) return false;
            return g.required.every(gr => sd.required.some(sr => sr.url === gr.url)) &&
                g.optional.every(go => sd.optional.some(so => so.url === go.url));
        });

        if (match) {
            match.labels.push(sd.target.label);
        } else {
            groupedSpecific.push({
                labels: [sd.target.label],
                required: sd.required,
                optional: sd.optional
            });
        }
    });

    return (
        <div
            className={`mt-3 space-y-2 pt-3 border-t border-gray-100/50 dark:border-gray-700/50 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            {/* Header & Legend */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <div
                    className="font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
                    Dependencies
                </div>
                {(anyRequired || anyOptional) && (
                    <div
                        className="flex flex-wrap gap-x-2 text-[8px] font-bold uppercase tracking-wider opacity-60 mr-2">
                        {anyRequired &&
                            <span
                                className="text-rose-600 dark:text-rose-400 whitespace-nowrap">Red = Required</span>}
                        {anyOptional &&
                            <span
                                className="text-amber-600 dark:text-amber-400 whitespace-nowrap">Orange = Optional</span>}
                    </div>
                )}
            </div>

            {/* Common Dependencies */}
            {(commonRequired.length > 0 || commonOptional.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {groupedSpecific.length > 0 && (
                        <div
                            className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-tighter mr-1 whitespace-nowrap">
                            Universal:
                        </div>
                    )}
                    {commonRequired.map((dep, i) => (
                        <a key={i} href={dep.url} target="_blank"
                           rel="noopener noreferrer"
                           className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap">
                            {dep.name}
                        </a>
                    ))}
                    {commonOptional.map((dep, i) => (
                        <a key={i} href={dep.url} target="_blank"
                           rel="noopener noreferrer"
                           className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap">
                            {dep.name}
                        </a>
                    ))}
                </div>
            )}

            {/* Grouped Version Specific Dependencies */}
            {groupedSpecific.map((group, idx) => (
                <div key={idx}
                     className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div
                        className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-tighter mr-1 whitespace-nowrap">
                        {group.labels.map((label, i) => (
                            <React.Fragment key={i}>
                                <span
                                    className="bg-gray-100 dark:bg-gray-700/50 px-1 py-0.5 rounded text-gray-600 dark:text-gray-300 mr-1">
                                    {label}
                                </span>
                                {i < group.labels.length - 1 &&
                                    <span className="mr-1">&</span>}
                            </React.Fragment>
                        ))}
                        specific:
                    </div>
                    {group.required.map((dep, i) => (
                        <a key={i} href={dep.url} target="_blank"
                           rel="noopener noreferrer"
                           className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap">
                            {dep.name}
                        </a>
                    ))}
                    {group.optional.map((dep, i) => (
                        <a key={i} href={dep.url} target="_blank"
                           rel="noopener noreferrer"
                           className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap">
                            {dep.name}
                        </a>
                    ))}
                </div>
            ))}
        </div>
    );
};

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
    const [isDependencyView, setIsDependencyView] = useState(false);
    const [dependencies, setDependencies] = useState<Record<string, Record<string, {
        required: { name: string, url: string }[],
        optional: { name: string, url: string }[]
    }>>>({});
    const [loadingDeps, setLoadingDeps] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    // Refs for use in effects to avoid unnecessary re-triggers
    const dependenciesRef = React.useRef(dependencies);
    dependenciesRef.current = dependencies;
    const loadingDepsRef = React.useRef(loadingDeps);
    loadingDepsRef.current = loadingDeps;

    // Load from localStorage on mount
    React.useEffect(() => {
        const compact = safeStorage.getItem('epicraft_isCompact') === 'true';
        const depView = safeStorage.getItem('epicraft_isDependencyView') === 'true';
        const deps = safeStorage.getItem('epicraft_dependencies');

        if (compact) setIsCompact(true);
        if (depView) setIsDependencyView(true);
        if (deps) {
            try {
                setDependencies(JSON.parse(deps));
            } catch (e) {
                console.error('Failed to parse dependencies from storage', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save preferences and dependencies to localStorage
    React.useEffect(() => {
        if (isLoaded) {
            safeStorage.setItem('epicraft_isCompact', String(isCompact));
        }
    }, [isCompact, isLoaded]);

    React.useEffect(() => {
        if (isLoaded) {
            safeStorage.setItem('epicraft_isDependencyView', String(isDependencyView));
        }
    }, [isDependencyView, isLoaded]);

    React.useEffect(() => {
        if (isLoaded && Object.keys(dependencies).length > 0) {
            safeStorage.setItem('epicraft_dependencies', JSON.stringify(dependencies));
        }
    }, [dependencies, isLoaded]);

    React.useEffect(() => {
        if (!isLoaded) return;
        const controller = new AbortController();
        const fetchDeps = async () => {
            const currentDeps = dependenciesRef.current;
            const currentLoading = loadingDepsRef.current;
            const toFetch = mods.filter(m => {
                const id = m.modrinthId ? `modrinth_${m.modrinthId}` : `curseforge_${m.curseforgeId}`;
                return (m.modrinthId || m.curseforgeId) && !currentDeps[id] && !currentLoading.has(id);
            });

            if (toFetch.length === 0) return;

            const modrinthIds: string[] = [];
            const curseforgeIds: number[] = [];

            toFetch.forEach(m => {
                if (m.modrinthId) {
                    modrinthIds.push(m.modrinthId);
                } else if (m.curseforgeId) {
                    curseforgeIds.push(m.curseforgeId);
                }
            });

            const modrinthChunks = [];
            for (let i = 0; i < modrinthIds.length; i += 10) modrinthChunks.push(modrinthIds.slice(i, i + 10));

            const curseforgeChunks = [];
            for (let i = 0; i < curseforgeIds.length; i += 10) curseforgeChunks.push(curseforgeIds.slice(i, i + 10));

            setLoadingDeps(prev => {
                const next = new Set(prev);
                toFetch.forEach(m => {
                    const id = m.modrinthId ? `modrinth_${m.modrinthId}` : `curseforge_${m.curseforgeId}`;
                    next.add(id);
                });
                return next;
            });

            try {
                for (const chunk of modrinthChunks) {
                    try {
                        const res = await fetch(`/api/mods/dependencies?modrinthIds=${chunk.join(',')}`, {
                            signal: controller.signal
                        });
                        if (res.ok) {
                            const data = await res.json();
                            setDependencies(prev => ({...prev, ...data}));
                        }
                    } catch (e: unknown) {
                        if (e instanceof Error && e.name !== 'AbortError') console.error(e);
                    }
                }

                for (const chunk of curseforgeChunks) {
                    try {
                        const res = await fetch(`/api/mods/dependencies?curseforgeIds=${chunk.join(',')}`, {
                            signal: controller.signal
                        });
                        if (res.ok) {
                            const data = await res.json();
                            setDependencies(prev => ({...prev, ...data}));
                        }
                    } catch (e: unknown) {
                        if (e instanceof Error && e.name !== 'AbortError') console.error(e);
                    }
                }
            } finally {
                setLoadingDeps(prev => {
                    const next = new Set(prev);
                    toFetch.forEach(m => next.delete(m.modrinthId ? `modrinth_${m.modrinthId}` : `curseforge_${m.curseforgeId}`));
                    return next;
                });
            }
        };

        fetchDeps();
        return () => controller.abort();
    }, [mods, isLoaded]); // Depend on mods and isLoaded to ensure we have localStorage data first

    const clearDependencyCache = () => {
        if (confirm('Clear all cached dependency data?')) {
            setDependencies({});
            safeStorage.removeItem('epicraft_dependencies');
        }
    };

    const cachedCount = Object.keys(dependencies).length;

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
                (m.isArchived && 'archived'.includes(s)) ||
                m.links.some(l => l.label.toLowerCase().includes(s) || l.url.toLowerCase().includes(s))
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
        if (categoryFilter) {
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
        }

        return [{name: null, mods: filteredMods}];
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
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Category Filters */}
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

                <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                    <div className="relative flex-1 w-full">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Search ${filteredMods.length} mods...`}
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

                    <button
                        onClick={() => setIsDependencyView(!isDependencyView)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium whitespace-nowrap w-full md:w-auto justify-center cursor-pointer ${
                            isDependencyView
                                ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                        </svg>
                        Dependency View
                    </button>

                    {isDependencyView && cachedCount > 0 && (
                        <button
                            onClick={clearDependencyCache}
                            className="flex items-center gap-2 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 cursor-pointer"
                            title="Clear Dependency Cache"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    )}
                </div>
                {isDependencyView && (
                    <div className="flex justify-center items-center gap-4 text-[11px] text-gray-400 font-medium">
                        <span>{mods.length} Mods</span>
                        {cachedCount > 0 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span>{cachedCount} Cached</span>
                            </>
                        )}
                        {loadingDeps.size > 0 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse"></span>
                                <span className="text-orange-500">Fetching {loadingDeps.size}...</span>
                            </>
                        )}
                    </div>
                )}

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
                                                                            : mod.links[0]?.url
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

                                    {/* Dependencies Section */}
                                    {isDependencyView && (() => {
                                        const depKey = mod.modrinthId ? `modrinth_${mod.modrinthId}` : (mod.curseforgeId ? `curseforge_${mod.curseforgeId}` : null);
                                        const modDeps = depKey ? dependencies[depKey] : null;
                                        if (!modDeps) return null;
                                        return <ModDependencies mod={mod} modDeps={modDeps} isCompact={isCompact}/>;
                                    })()}

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
                                        {mod.links.filter(l => l.url.trim() !== '').map((link, lIdx) => {
                                            const url = link.url;
                                            let displayLabel = link.label.trim();
                                            if (displayLabel.startsWith('http')) {
                                                if (displayLabel.includes('modrinth')) displayLabel = 'MODRINTH URL';
                                                else if (displayLabel.includes('curseforge')) displayLabel = 'CURSEFORGE URL';
                                                else displayLabel = 'URL';
                                            }
                                            displayLabel = displayLabel.toUpperCase();

                                            return (
                                                <a
                                                    key={lIdx}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer"
                                                >
                                                    {url.includes('google.com/search') ? '🔍' : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5"
                                                             fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={2.5}
                                                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                                        </svg>
                                                    )}
                                                    <span>{lIdx > 0 ? `ALTERNATIVE: ${displayLabel}` : displayLabel}</span>
                                                </a>
                                            );
                                        })}
                                        {(mod.links.filter(l => l.url.trim() !== '').length === 0) && (
                                            <a
                                                href={`https://www.google.com/search?q=${encodeURIComponent(mod.name + ' minecraft mod')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer"
                                            >
                                                🔍 SEARCH WEB
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
