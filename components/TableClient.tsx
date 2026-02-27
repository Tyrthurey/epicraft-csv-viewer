'use client';
import React, {useMemo, useState} from 'react';

interface CellData {
    value: unknown;
    hyperlink?: string;
    color?: string;
}

type Row = Record<string, CellData>;

interface SheetData {
    name: string;
    fields: string[];
    rows: Row[];
}

const COLOR_MAPPING: Record<string, { bgColor: string, textColor: string, defaultText: string }> = {
    'FFF28E85': {
        bgColor: 'bg-rose-50 dark:bg-rose-900/30',
        textColor: 'text-rose-600 dark:text-rose-400',
        defaultText: 'No'
    },
    'FFFDE49A': {
        bgColor: 'bg-amber-50 dark:bg-amber-900/30',
        textColor: 'text-amber-600 dark:text-amber-400',
        defaultText: 'Partial'
    },
    'FFFFC499': {
        bgColor: 'bg-orange-50 dark:bg-orange-900/30',
        textColor: 'text-orange-600 dark:text-orange-400',
        defaultText: 'Unsure'
    },
};

const VersionBadge = ({label, cell, isCompact, isVanillaTweaks}: {
    label: string;
    cell: CellData;
    isCompact?: boolean;
    isVanillaTweaks?: boolean
}) => {
    const value = cell?.value;
    const color = cell?.color;

    const val = String(value || '').trim().toLowerCase();
    const isTrue = val === 'true' || val === '1' || val === 'yes' || isVanillaTweaks;
    const isFalse = val === 'false' || val === '0' || val === 'no' && !isVanillaTweaks;
    const isDatapack = val.includes('datapack');

    // ARGB Color mapping based on inspection:
    // FFF28E85 -> Red (Not available)
    // FFFDE49A -> Yellow (Partial / Archived / Try below)
    // FFFFC499 -> Orange (Unsure / Likely not added)

    let bgColor = 'bg-gray-50 dark:bg-gray-700';
    let textColor = 'text-gray-600 dark:text-gray-400';
    let displayText = String(value || 'Not found');

    if (color && COLOR_MAPPING[color]) {
        const mapping = COLOR_MAPPING[color];
        bgColor = mapping.bgColor;
        textColor = mapping.textColor;
        displayText = value ? String(value) : mapping.defaultText;
    } else if (isTrue) {
        bgColor = 'bg-emerald-50 dark:bg-emerald-900/30';
        textColor = 'text-emerald-600 dark:text-emerald-400';
        displayText = 'Available';
    } else if (isFalse) {
        bgColor = 'bg-rose-50 dark:bg-rose-900/30';
        textColor = 'text-rose-600 dark:text-rose-400';
        displayText = 'Not available';
    } else if (isDatapack) {
        bgColor = 'bg-purple-50 dark:bg-purple-900/30';
        textColor = 'text-purple-600 dark:text-purple-400';
        displayText = 'Datapack';
    } else if (val !== '') {
        bgColor = 'bg-orange-50 dark:bg-orange-900/30';
        textColor = 'text-orange-600 dark:text-orange-400';
    }

    return (
        <div
            className={`flex flex-col rounded-xl transition-all duration-200 hover:scale-[1.02] justify-center ${isCompact ? 'p-1.5 min-h-10' : 'p-2.5 min-h-15'} ${bgColor}`}>
            <span
                className={`font-medium text-gray-500 dark:text-gray-400 mb-0.5 leading-tight ${isCompact ? 'text-[8px]' : 'text-[10px]'}`}>
                {isCompact ? label.replace(/Neoforge/i, 'NEO').replace(/Forge/i, 'FOR').replace(/Fabric/i, 'FAB') : label}
            </span>
            <span
                className={`font-semibold leading-snug wrap-break-word ${textColor} ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{displayText}</span>
        </div>
    );
};

// Check if a row is a category delimiter
const isCategoryDelimiter = (row: Row, versionFields: string[], allFields: string[]) => {
    if (versionFields.length === 0) return false;

    const firstCell = Object.values(row)[0];
    const firstVal = String(firstCell?.value || '').trim();
    if (!firstVal) return false;

    // Check if all version fields are dashes
    const allDashes = versionFields.every(field => {
        const val = String(row[field]?.value || '').trim();
        return val !== '' && !!val.match(/^-+$/);
    });
    if (allDashes) return true;

    // Check if version fields repeat headers or are empty
    const allMatchOrEmpty = versionFields.every(field => {
        const val = String(row[field]?.value || '').trim().toLowerCase();
        const fieldLower = field.toLowerCase().trim();
        return val === '' || val === fieldLower;
    });

    if (allMatchOrEmpty) {
        // Avoid treating the header row itself as a category if it somehow leaked through
        if (firstVal.toLowerCase() === 'mod name') return false;

        // For it to be a category title (like "General mods"), 
        // the link/note fields should usually be empty too.
        const otherFields = allFields.filter(f => !versionFields.includes(f) && f !== allFields[0]);
        const otherEmpty = otherFields.every(f => String(row[f]?.value || '').trim() === '');

        if (otherEmpty) return true;
    }

    return false;
};

export default function TableClient({sheets}: { sheets: SheetData[] }) {
    const [activeTab, setActiveTab] = useState(sheets[0]?.name || '');
    const [q, setQ] = useState('');
    const [isCompact, setIsCompact] = useState(false);

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

    const currentSheet = useMemo(() =>
            sheets.find(s => s.name === activeTab) || sheets[0]
        , [activeTab, sheets]);

    const versionFields = useMemo(() => {
        if (!currentSheet) return [];
        return currentSheet.fields.filter(f =>
            f.toLowerCase().includes('1.') ||
            f.toLowerCase().includes('neo') ||
            f.toLowerCase().includes('fabric') ||
            f.toLowerCase().includes('forge')
        ).sort((a, b) => {
            const getVersion = (s: string) => {
                const v = s.toLowerCase();
                if (v.includes('1.20')) return 120;
                if (v.includes('1.21')) return 121;
                const match = v.match(/1\.(\d+)/);
                return match ? parseInt(match[1]) : 999;
            };
            const vA = getVersion(a);
            const vB = getVersion(b);
            if (vA !== vB) return vA - vB;
            return a.localeCompare(b);
        });
    }, [currentSheet]);

    const filteredRows = useMemo(() => {
        if (!currentSheet) return [];
        let rows = currentSheet.rows;

        // Exclude the legend/note rows that appear at the top of sheets
        rows = rows.filter(r => {
            const firstCell = Object.values(r)[0];
            const firstVal = String(firstCell?.value || '').trim();
            const lowerVal = firstVal.toLowerCase();
            return firstVal &&
                !lowerVal.includes('check = available') &&
                !lowerVal.includes('server/both side mods') &&
                lowerVal !== 'mod name';
        });

        if (!q) return rows;
        const ql = q.toLowerCase();
        return rows.filter((r) =>
            Object.values(r).some((cell) =>
                String(cell?.value || '').toLowerCase().includes(ql)
            )
        );
    }, [q, currentSheet]);


    // Group rows by categories
    const groupedRows = useMemo(() => {
        const groups: Array<{ type: 'delimiter' | 'cards'; data: Row | Row[] }> = [];
        let currentGroup: Row[] = [];

        filteredRows.forEach((row) => {
            if (isCategoryDelimiter(row, versionFields, currentSheet.fields)) {
                if (currentGroup.length > 0) {
                    groups.push({type: 'cards', data: currentGroup});
                    currentGroup = [];
                }
                groups.push({type: 'delimiter', data: row});
            } else {
                currentGroup.push(row);
            }
        });

        if (currentGroup.length > 0) {
            groups.push({type: 'cards', data: currentGroup});
        }

        return groups;
    }, [filteredRows, versionFields, currentSheet]);

    if (!currentSheet) return null;

    return (
        <div className="space-y-6">
            {/* Tab Navigation - Static */}
            <div className="flex flex-wrap justify-center gap-2.5 mb-8">
                {sheets.map((sheet) => (
                    <button
                        key={sheet.name}
                        onClick={() => {
                            setActiveTab(sheet.name);
                            setQ('');
                        }}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                            activeTab === sheet.name
                                ? 'bg-linear-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-200/50 dark:shadow-orange-900/50'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800'
                        }`}
                    >
                        {sheet.name}
                    </button>
                ))}
            </div>

            {/* Search Bar - Static */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto">
                    <div className="relative flex-1 w-full">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={`Search ${filteredRows.length} mods...`}
                            className="w-full pl-11 pr-11 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 dark:focus:border-orange-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-all duration-200 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        <div className="absolute left-3.5 top-3.5 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                        {q && (
                            <button
                                onClick={() => setQ('')}
                                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-orange-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20"
                                     fill="currentColor">
                                    <path fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                          clipRule="evenodd"/>
                                </svg>
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsCompact(!isCompact)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium whitespace-nowrap w-full md:w-auto justify-center ${
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
            </div>

            {/* Mod Cards with Category Delimiters */}
            <div>
                {groupedRows.map((group, groupIdx) => {
                    if (group.type === 'delimiter') {
                        const row = group.data as Row;
                        const modNameCell = row['MOD NAME'] || Object.values(row)[0];
                        const modName = String(modNameCell?.value || 'Unknown Mod');

                        return (
                            <div key={groupIdx} className="flex items-center gap-4 my-12 first:mt-0">
                                <div
                                    className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 px-4 py-2 bg-linear-to-r from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 rounded-full border border-orange-200 dark:border-orange-800 whitespace-nowrap">
                                    {modName}
                                </h2>
                                <div
                                    className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                            </div>
                        );
                    }

                    // Render cards group
                    const rows = group.data as Row[];
                    return (
                        <div key={groupIdx} className={`grid gap-5 mb-8 ${
                            isCompact
                                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]'
                                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]'
                        }`}>
                            {rows.map((row, idx) => {
                                const modNameCell = row['MOD NAME'] || Object.values(row)[0];
                                const modName = String(modNameCell?.value || 'Unknown Mod');
                                const isVanillaTweaks = modName.toLowerCase().includes('vanilla tweaks');

                                const getLinkInfo = (cell?: CellData): { url: string; label: string } | null => {
                                    if (!cell) return null;
                                    const value = String(cell.value || '').trim();
                                    const hyperlink = cell.hyperlink;

                                    if (hyperlink) {
                                        return {url: hyperlink, label: value || hyperlink};
                                    }

                                    if (value.startsWith('http')) {
                                        return {url: value, label: value};
                                    }

                                    if (value.length > 0) {
                                        // It's a search term or a short name
                                        return {
                                            url: `https://www.google.com/search?q=${encodeURIComponent(modName + ' ' + value)}`,
                                            label: value
                                        };
                                    }

                                    return null;
                                };

                                const link1 = getLinkInfo(row['Link']);
                                const link2 = getLinkInfo(row['Link 2']);
                                const links = [link1, link2].filter((l): l is {
                                    url: string;
                                    label: string
                                } => l !== null);

                                const note1 = row['Video/Note'];
                                const note2 = row['Note 2'];
                                const notes = [note1, note2].filter((n): n is CellData => !!n && String(n.value || '').trim() !== '');

                                return (
                                    <div key={idx}
                                         className={`group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.15)] dark:hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.25)] hover:bg-orange-50/40 dark:hover:bg-gray-700/30 hover:border-orange-500/30 hover:ring-1 hover:ring-orange-500/20 transition-all duration-200 hover:-translate-y-1 flex flex-col h-full ${
                                             isCompact ? 'p-3' : 'p-5'
                                         }`}>
                                        <div className={isCompact ? 'mb-2' : 'mb-4'}>
                                            <h3 className={`font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors duration-200 ${
                                                isCompact ? 'text-sm' : 'text-xl'
                                            }`}>
                                                {modNameCell?.hyperlink ? (
                                                    <a href={modNameCell.hyperlink} target="_blank"
                                                       rel="noopener noreferrer"
                                                       className="hover:underline decoration-orange-400 dark:decoration-orange-600 underline-offset-2">
                                                        {modName}
                                                    </a>
                                                ) : modName}
                                                {modNameCell?.color && COLOR_MAPPING[modNameCell.color] && (
                                                    <span
                                                        className={`ml-2 px-1.5 py-0.5 rounded-md ${COLOR_MAPPING[modNameCell.color].bgColor} ${COLOR_MAPPING[modNameCell.color].textColor} text-[10px] font-bold uppercase tracking-wider inline-block align-middle`}>
                                                        {modNameCell.color === 'FFFDE49A' ? 'Archived' : COLOR_MAPPING[modNameCell.color].defaultText}
                                                    </span>
                                                )}
                                            </h3>
                                        </div>

                                        <div
                                            className={`grid ${isCompact ? 'grid-cols-2' : 'grid-cols-4'} gap-2 mb-4 ${isCompact ? 'gap-1.5 mb-3' : 'gap-2.5 mb-5'}`}>
                                            {versionFields.slice(0, 4).map(vf => (
                                                <VersionBadge key={vf} label={vf} cell={row[vf]} isCompact={isCompact}
                                                              isVanillaTweaks={isVanillaTweaks}/>
                                            ))}
                                        </div>

                                        {!isCompact && (notes.length > 0) && (
                                            <div
                                                className="mt-auto mb-4 space-y-1.5 p-2 bg-amber-50/20 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                                                {notes.map((n, i) => {
                                                    const text = String(n.value || '');
                                                    const hyperlink = n.hyperlink;
                                                    return (
                                                        <div key={i}
                                                             className="text-[10px] text-gray-600 dark:text-gray-400 italic leading-tight flex gap-1.5 items-start">
                                                            <span className="text-amber-500/70 shrink-0">📌</span>
                                                            <div className="min-w-0">
                                                                {hyperlink ? (
                                                                    <a
                                                                        href={hyperlink}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="underline text-orange-600 dark:text-orange-400 decoration-orange-300 dark:decoration-orange-700 underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                                                    >
                                                                        {text}
                                                                    </a>
                                                                ) : (
                                                                    renderClickableText(text)
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div
                                            className={`flex flex-wrap gap-2 ${notes.length > 0 && !isCompact ? '' : 'mt-auto'} border-t border-gray-100 dark:border-gray-700 ${
                                                isCompact ? 'pt-2' : 'pt-4'
                                            }`}>
                                            {links.map((link, i) => (
                                                <a
                                                    key={i}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1.5 rounded-lg font-medium bg-linear-to-r from-orange-50 to-rose-50 dark:from-orange-900/40 dark:to-rose-900/40 text-orange-700 dark:text-orange-400 hover:from-orange-500 hover:to-rose-500 dark:hover:from-orange-600 dark:hover:to-rose-600 hover:text-white hover:shadow-sm transition-all duration-200 ${
                                                        isCompact ? 'px-2 py-1 text-[10px]' : 'px-3.5 py-2 text-xs'
                                                    }`}
                                                >
                                                    <span
                                                        className={isCompact ? 'text-[10px]' : 'text-xs'}>{link.url.includes('google.com/search') ? '🔍' : '↗'}</span>
                                                    {link.label.startsWith('http') ? (
                                                        link.label.includes('modrinth') ? 'Modrinth' : link.label.includes('curseforge') ? 'CurseForge' : 'Source'
                                                    ) : (
                                                        link.label
                                                    )}
                                                </a>
                                            ))}
                                            {links.length === 0 && (
                                                <a
                                                    href={`https://www.google.com/search?q=${encodeURIComponent(modName + ' mod')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1.5 rounded-lg font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 ${
                                                        isCompact ? 'px-2 py-1 text-[10px]' : 'px-3.5 py-2 text-xs'
                                                    }`}
                                                >
                                                    <span
                                                        className={isCompact ? 'text-[10px]' : 'text-xs'}>🔍</span> Search
                                                    web
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {filteredRows.length === 0 && (
                <div
                    className="py-24 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-5xl mb-5 grayscale opacity-30">📂</div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No matching mods
                        found</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">We couldn&apos;t find any mods
                        matching &quot;{q}&quot; in the {activeTab} category.</p>
                    <button
                        onClick={() => setQ('')}
                        className="px-5 py-2.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-lg font-medium hover:shadow-md hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50 transition-all"
                    >
                        Clear search
                    </button>
                </div>
            )}
        </div>
    );
}