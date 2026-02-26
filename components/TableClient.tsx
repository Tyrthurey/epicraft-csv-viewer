'use client';
import React, { useMemo, useState } from 'react';

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

const VersionBadge = ({ label, cell }: { label: string; cell: CellData }) => {
    const value = cell?.value;
    const color = cell?.color;
    
    const val = String(value || '').trim().toLowerCase();
    const isTrue = val === 'true' || val === '1' || val === 'yes';
    const isFalse = val === 'false' || val === '0' || val === 'no';
    const isDatapack = val.includes('datapack');
    
    // ARGB Color mapping based on inspection:
    // FFF28E85 -> Red (Not available)
    // FFFDE49A -> Yellow (Partial / Archived / Try below)
    // FFFFC499 -> Orange (Unsure / Likely not added)
    
    let bgColor = 'bg-gray-50 dark:bg-gray-700';
    let textColor = 'text-gray-600 dark:text-gray-400';
    let displayText = String(value || 'Not found');

    if (color === 'FFF28E85') {
        bgColor = 'bg-rose-50 dark:bg-rose-900/30';
        textColor = 'text-rose-600 dark:text-rose-400';
        displayText = value ? String(value) : 'No';
    } else if (color === 'FFFDE49A') {
        bgColor = 'bg-amber-50 dark:bg-amber-900/30';
        textColor = 'text-amber-600 dark:text-amber-400';
        displayText = value ? String(value) : 'Partial';
    } else if (color === 'FFFFC499') {
        bgColor = 'bg-orange-50 dark:bg-orange-900/30';
        textColor = 'text-orange-600 dark:text-orange-400';
        displayText = value ? String(value) : 'Unsure';
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
        <div className={`flex flex-col p-2.5 rounded-xl ${bgColor} transition-all duration-200 hover:scale-[1.02] justify-center min-h-15`}>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 leading-tight">{label}</span>
            <span className={`text-xs font-semibold leading-snug wrap-break-word ${textColor}`}>{displayText}</span>
        </div>
    );
};

export default function TableClient({ sheets }: { sheets: SheetData[] }) {
    const [activeTab, setActiveTab] = useState(sheets[0]?.name || '');
    const [q, setQ] = useState('');

    const currentSheet = useMemo(() => 
        sheets.find(s => s.name === activeTab) || sheets[0]
    , [activeTab, sheets]);

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

    // Group rows by categories
    const groupedRows = useMemo(() => {
        const groups: Array<{ type: 'delimiter' | 'cards'; data: Row | Row[] }> = [];
        let currentGroup: Row[] = [];

        const versionFields = currentSheet.fields.filter(f =>
            f.toLowerCase().includes('1.') ||
            f.toLowerCase().includes('neo') ||
            f.toLowerCase().includes('fabric') ||
            f.toLowerCase().includes('forge')
        );

        filteredRows.forEach((row) => {
            if (isCategoryDelimiter(row, versionFields, currentSheet.fields)) {
                if (currentGroup.length > 0) {
                    groups.push({ type: 'cards', data: currentGroup });
                    currentGroup = [];
                }
                groups.push({ type: 'delimiter', data: row });
            } else {
                currentGroup.push(row);
            }
        });

        if (currentGroup.length > 0) {
            groups.push({ type: 'cards', data: currentGroup });
        }

        return groups;
    }, [filteredRows, currentSheet]);

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
                <div className="relative max-w-2xl mx-auto">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={`Search ${filteredRows.length} mods...`}
                        className="w-full pl-11 pr-11 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 dark:focus:border-orange-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-all duration-200 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                    <div className="absolute left-3.5 top-3.5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    {q && (
                        <button
                            onClick={() => setQ('')}
                            className="absolute right-3.5 top-3.5 text-gray-400 hover:text-orange-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
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
                                <div className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 px-4 py-2 bg-linear-to-r from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 rounded-full border border-orange-200 dark:border-orange-800 whitespace-nowrap">
                                    {modName}
                                </h2>
                                <div className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                            </div>
                        );
                    }

                    // Render cards group
                    const rows = group.data as Row[];
                    const versionFields = currentSheet.fields.filter(f =>
                        f.toLowerCase().includes('1.') ||
                        f.toLowerCase().includes('neo') ||
                        f.toLowerCase().includes('fabric') ||
                        f.toLowerCase().includes('forge')
                    );

                    return (
                        <div key={groupIdx} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                            {rows.map((row, idx) => {
                                const modNameCell = row['MOD NAME'] || Object.values(row)[0];
                                const modName = String(modNameCell?.value || 'Unknown Mod');

                                const getLinkInfo = (cell?: CellData): { url: string; label: string } | null => {
                                    if (!cell) return null;
                                    const value = String(cell.value || '').trim();
                                    const hyperlink = cell.hyperlink;
                                    
                                    if (hyperlink) {
                                        return { url: hyperlink, label: value || hyperlink };
                                    }
                                    
                                    if (value.startsWith('http')) {
                                        return { url: value, label: value };
                                    }
                                    
                                    if (value.length > 0) {
                                        // It's a search term or a short name
                                        return { url: `https://www.google.com/search?q=${encodeURIComponent(modName + ' ' + value)}`, label: value };
                                    }
                                    
                                    return null;
                                };

                                const link1 = getLinkInfo(row['Link']);
                                const link2 = getLinkInfo(row['Link 2']);
                                const links = [link1, link2].filter((l): l is { url: string; label: string } => l !== null);

                                const note1 = String(row['Video/Note']?.value || '');
                                const note2 = String(row['Note 2']?.value || '');
                                const notes = [note1, note2].filter(n => n && n.length > 0);

                                return (
                                    <div key={idx} className="group bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-700 shadow-sm hover:shadow-lg dark:hover:shadow-orange-900/20 transition-all duration-300 hover:-translate-y-0.5 flex flex-col h-full">
                                        <div className="mb-4">
                                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors duration-200">
                                                {modName}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                                            {versionFields.slice(0, 4).map(vf => (
                                                <VersionBadge key={vf} label={vf} cell={row[vf]} />
                                            ))}
                                        </div>

                                        {(notes.length > 0) && (
                                            <div className="mb-5 space-y-2 grow">
                                                {notes.map((n, i) => (
                                                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400 bg-amber-50/50 dark:bg-amber-900/20 p-3 rounded-lg italic leading-relaxed">
                                                        {n}
                                                    </p>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                                            {links.map((link, i) => (
                                                <a
                                                    key={i}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-linear-to-r from-orange-50 to-rose-50 dark:from-orange-900/40 dark:to-rose-900/40 text-orange-700 dark:text-orange-400 hover:from-orange-500 hover:to-rose-500 dark:hover:from-orange-600 dark:hover:to-rose-600 hover:text-white hover:shadow-sm transition-all duration-200"
                                                >
                                                    <span className="text-xs">{link.url.includes('google.com/search') ? '🔍' : '↗'}</span>
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
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                                                >
                                                    <span className="text-xs">🔍</span> Search web
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
                <div className="py-24 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-5xl mb-5 grayscale opacity-30">📂</div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No matching mods found</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">We couldn&apos;t find any mods matching &quot;{q}&quot; in the {activeTab} category.</p>
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