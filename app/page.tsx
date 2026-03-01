import React from 'react';
import {fetchExcelData, Row, CellData} from '@/lib/excel';
import {
    fetchModrinthProjects,
    checkSupport,
    ModrinthProject
} from '@/lib/modrinth';
import {
    fetchCurseForgeMods,
    resolveCurseForgeSlug,
    checkCurseForgeSupport,
    CurseForgeMod,
    getCurseForgeApiKey
} from '@/lib/curseforge';
import ModListClient, {UnifiedMod, ModLink} from '@/components/ModListClient';

export const dynamic = 'force-dynamic';

function extractModrinthId(url: string | undefined): { id: string; type: string } | null {
    if (!url) return null;
    const normalized = url.toLowerCase();

    const match = normalized.match(/modrinth\.com\/(mod|datapack|plugin|resourcepack|shader)\/([^/?#]+)/);
    if (match) {
        return {id: match[2], type: match[1]};
    }

    return null;
}

function extractCurseForgeSlug(url: string | undefined): string | null {
    if (!url) return null;
    const normalized = url.toLowerCase();

    // Standard format: curseforge.com/minecraft/SECTION/slug
    const match = normalized.match(/curseforge\.com\/minecraft\/([^/]+)\/([^/?#]+)/);
    if (match) return match[2];

    // Alternative format: minecraft.curseforge.com/SECTION/slug
    const altMatch = normalized.match(/minecraft\.curseforge\.com\/([^/]+)\/([^/?#]+)/);
    if (altMatch) return altMatch[2];

    // Project ID format: curseforge.com/projects/slug-or-id
    const projectMatch = normalized.match(/curseforge\.com\/projects\/([^/?#]+)/);
    if (projectMatch) return projectMatch[1];

    // Generic mod format: curseforge.com/mc-mods/slug (rarely used but possible)
    const genericMatch = normalized.match(/curseforge\.com\/mc-mods\/([^/?#]+)/);
    if (genericMatch) return genericMatch[1];

    return null;
}

function normalizeLink(url: string): string {
    try {
        const u = new URL(url);
        u.hostname = u.hostname.toLowerCase();
        if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
            u.pathname = u.pathname.slice(0, -1);
        }
        return u.toString();
    } catch {
        return url.trim();
    }
}

function getDelimiter(row: Row, fields: string[]): string | null {
    const firstCell = Object.values(row)[0];
    const firstVal = String(firstCell?.value || '').trim();
    const lowerVal = firstVal.toLowerCase();

    if (!firstVal) return null;
    if (lowerVal.includes('check = available')) return null;
    if (lowerVal.includes('server/both side mods')) return null;
    if (lowerVal === 'mod name') return null;

    // Category delimiter logic from TableClient.tsx
    const versionFields = fields.filter(f =>
        f.toLowerCase().includes('1.') ||
        f.toLowerCase().includes('neo') ||
        f.toLowerCase().includes('fabric') ||
        f.toLowerCase().includes('forge')
    );

    if (versionFields.length > 0) {
        const allDashes = versionFields.every(field => {
            const val = String(row[field]?.value || '').trim();
            return val !== '' && !!val.match(/^-+$/);
        });
        if (allDashes) {
            // Clean up dashes from the title
            return firstVal.replace(/^-+|-+$/g, '').trim() || 'General';
        }

        const allMatchOrEmpty = versionFields.every(field => {
            const val = String(row[field]?.value || '').trim().toLowerCase();
            const fieldLower = field.toLowerCase().trim();
            return val === '' || val === fieldLower;
        });

        if (allMatchOrEmpty) {
            const otherFields = fields.filter(f => !versionFields.includes(f) && f !== fields[0]);
            const otherEmpty = otherFields.every(f => String(row[f]?.value || '').trim() === '');
            if (otherEmpty) return firstVal;
        }
    }

    return null;
}

function isInvalidRow(row: Row, fields: string[]) {
    const firstCell = Object.values(row)[0];
    const firstVal = String(firstCell?.value || '').trim();
    const lowerVal = firstVal.toLowerCase();

    if (!firstVal) return true;
    if (lowerVal.includes('check = available')) return true;
    if (lowerVal.includes('server/both side mods')) return true;
    if (lowerVal === 'mod name') return true;

    return !!getDelimiter(row, fields);
}

function parseSpreadsheetSupport(row: Row, fieldName: string): boolean | 'partial' | 'unsure' {
    const cell = row[fieldName];
    if (!cell) return false;

    const val = String(cell.value || '').trim().toLowerCase();
    const color = cell.color;

    // FFF28E85 -> Red (Not available)
    // FFFDE49A -> Yellow (Partial / Archived / Try below)
    // FFFFC499 -> Orange (Unsure / Likely not added)

    if (color === 'FFF28E85') return false;
    if (color === 'FFFDE49A') return 'partial';
    if (color === 'FFFFC499') return 'unsure';

    const isTrue = val === 'true' || val === '1' || val === 'yes' || val === 'check' || val === 'available';
    if (isTrue) return true;

    const isFalse = val === 'false' || val === '0' || val === 'no';
    if (isFalse) return false;

    // Fallback if there is some other text but it's not explicitly true/false
    if (val !== '') return 'unsure';

    return false;
}

export default async function ModListPage() {
    const excelUrl = process.env.DOCUMENT_URL;
    if (!excelUrl) {
        return <div>Missing DOCUMENT_URL</div>;
    }

    const {data: sheets, error} = await fetchExcelData(excelUrl);
    if (error || !sheets) {
        return <div>Error loading data: {error}</div>;
    }

    const entries: Array<{
        modName: string;
        description: string;
        primaryLink: string;
        links: ModLink[];
        modrinthId: string | null;
        curseforgeSlug: string | null;
        projectType: string;
        isArchived: boolean;
        support: UnifiedMod['support'];
        category: string;
        subcategory: string | null;
        notes: { value: string; hyperlink?: string }[];
    }> = [];

    for (const sheet of sheets) {
        let currentSubcategory: string | null = null;
        for (const row of sheet.rows) {
            const delimiter = getDelimiter(row, sheet.fields);
            if (delimiter) {
                currentSubcategory = delimiter;
                continue;
            }

            if (isInvalidRow(row, sheet.fields)) continue;

            const modNameCell = row['MOD NAME'] || Object.values(row)[0];
            const modName = String(modNameCell?.value || '').trim();
            if (!modName) continue;

            const link1Cell = row['Link'];
            const link2Cell = row['Link 2'];
            const modNameHyperlink = modNameCell?.hyperlink;

            const getLinkData = (cell: CellData | undefined, defaultLabel?: string): ModLink | null => {
                if (!cell) return null;
                const value = String(cell.value || '').trim();
                const hyperlink = cell.hyperlink;
                if (!hyperlink && !value) return null;

                let url = hyperlink || value;
                if (!url.startsWith('http')) {
                    url = `https://www.google.com/search?q=${encodeURIComponent(modName + ' ' + url)}`;
                } else {
                    url = normalizeLink(url);
                }

                return {
                    url,
                    label: value || defaultLabel || url
                };
            };

            const rowLinks: ModLink[] = [
                modNameHyperlink ? {url: normalizeLink(modNameHyperlink), label: modName} : null,
                getLinkData(link1Cell),
                getLinkData(link2Cell)
            ].filter((l): l is ModLink => l !== null);

            const note1 = row['Video/Note'];
            const note2 = row['Note 2'];
            const notes = [note1, note2]
                .filter((n) => n && String(n.value || '').trim() !== '')
                .map(n => ({
                    value: String(n!.value),
                    hyperlink: n!.hyperlink
                }));

            const description = notes.length > 0 ? notes[0].value : '';

            // Check if it's archived from spreadsheet color
            const isArchivedFromSpreadsheet = modNameCell?.color === 'FFFDE49A';

            const support = {
                forge1201: parseSpreadsheetSupport(row, 'FORGE 1.20.1'),
                fabric1201: parseSpreadsheetSupport(row, 'FABRIC 1.20.1'),
                neoforge1211: parseSpreadsheetSupport(row, 'NEO 1.21.1'),
                fabric1211: parseSpreadsheetSupport(row, 'FABRIC 1.21.1')
            };

            const lowerSheetName = sheet.name.toLowerCase();
            const lowerModName = modName.toLowerCase();
            const isResourcePack = lowerSheetName.includes('resource pack') || lowerModName.includes('resource pack');
            const isDatapack = lowerSheetName.includes('datapack') || lowerModName.includes('datapack');
            const isVanillaTweaks = lowerModName.includes('vanilla tweaks');

            if (isResourcePack || isDatapack) {
                const has1201 = support.forge1201 || support.fabric1201;
                support.forge1201 = has1201;
                support.fabric1201 = has1201;
                const has1211 = support.neoforge1211 || support.fabric1211;
                support.neoforge1211 = has1211;
                support.fabric1211 = has1211;
            }

            if (isVanillaTweaks) {
                support.forge1201 = true;
                support.fabric1201 = true;
                support.neoforge1211 = true;
                support.fabric1211 = true;
            }

            const linksToPush = rowLinks.length > 0 ? rowLinks : [{url: '', label: ''}];
            for (const primaryLink of linksToPush) {
                const modrinthInfo = extractModrinthId(primaryLink.url);
                const curseforgeSlug = extractCurseForgeSlug(primaryLink.url);

                let effectiveType = modrinthInfo?.type || 'mod';
                if (isDatapack && effectiveType === 'mod') effectiveType = 'datapack';
                if (isResourcePack && effectiveType === 'mod') effectiveType = 'resourcepack';

                // Reorder links so that primaryLink is first
                const orderedLinks = [
                    primaryLink,
                    ...rowLinks.filter(l => l.url !== primaryLink.url)
                ];

                entries.push({
                    modName,
                    description,
                    primaryLink: primaryLink.url,
                    links: orderedLinks,
                    modrinthId: modrinthInfo?.id || null,
                    curseforgeSlug,
                    projectType: effectiveType,
                    isArchived: isArchivedFromSpreadsheet,
                    support,
                    category: sheet.name,
                    subcategory: currentSubcategory,
                    notes
                });
            }
        }
    }

    // Merge support statuses by taking the most "positive" one
    const mergeSupport = (a: UnifiedMod['support'], b: UnifiedMod['support']): UnifiedMod['support'] => {
        const getPriority = (s: boolean | 'partial' | 'unsure') => {
            if (s === true) return 3;
            if (s === 'partial') return 2;
            if (s === 'unsure') return 1;
            return 0;
        };
        const pickBetter = (s1: boolean | 'partial' | 'unsure', s2: boolean | 'partial' | 'unsure') => {
            return getPriority(s1) >= getPriority(s2) ? s1 : s2;
        };

        return {
            forge1201: pickBetter(a.forge1201, b.forge1201),
            fabric1201: pickBetter(a.fabric1201, b.fabric1201),
            neoforge1211: pickBetter(a.neoforge1211, b.neoforge1211),
            fabric1211: pickBetter(a.fabric1211, b.fabric1211)
        };
    };

    // Deduplicate entries by mod name + primary link, merging categories and notes
    const uniqueEntriesMap = new Map<string, typeof entries[0] & {
        categories: string[],
        subcategories: Record<string, string>
    }>();
    for (const entry of entries) {
        const key = `${entry.modName.toLowerCase()}|${entry.primaryLink.toLowerCase()}`;
        const existing = uniqueEntriesMap.get(key);
        if (existing) {
            existing.support = mergeSupport(existing.support, entry.support);
            if (!existing.categories.includes(entry.category)) {
                existing.categories.push(entry.category);
            }
            if (entry.subcategory) {
                existing.subcategories[entry.category] = entry.subcategory;
            }
            // Merge links, keeping primary links first
            for (const entryLink of entry.links) {
                if (!existing.links.some(l => l.url === entryLink.url)) {
                    existing.links.push(entryLink);
                }
            }
            // Merge notes if they are different
            for (const note of entry.notes) {
                if (!existing.notes.some(n => n.value === note.value)) {
                    existing.notes.push(note);
                }
            }
        } else {
            uniqueEntriesMap.set(key, {
                ...entry,
                categories: [entry.category],
                subcategories: entry.subcategory ? {[entry.category]: entry.subcategory} : {}
            });
        }
    }
    const finalEntries = Array.from(uniqueEntriesMap.values());

    const modrinthIds = Array.from(new Set(
        finalEntries.map(e => e.modrinthId).filter((id): id is string => !!id)
    ));

    // Fetch Modrinth data
    const modrinthProjects = await fetchModrinthProjects(modrinthIds);
    const modrinthProjectsMap = new Map<string, ModrinthProject>();
    modrinthProjects.forEach(p => {
        modrinthProjectsMap.set(p.id, p);
        modrinthProjectsMap.set(p.slug, p);
    });

    // Fetch CurseForge data
    const curseForgeApiKey = getCurseForgeApiKey();
    const curseForgeProjectsMap = new Map<number, CurseForgeMod>();
    const curseForgeSlugToIdMap = new Map<string, number>();

    if (curseForgeApiKey) {
        const curseForgeSlugs = Array.from(new Set(
            finalEntries.map(e => e.curseforgeSlug).filter((s): s is string => !!s)
        ));

        if (curseForgeSlugs.length > 0) {
            // Resolve slugs to IDs in small batches to avoid rate limiting
            const BATCH_SIZE = 5;
            for (let i = 0; i < curseForgeSlugs.length; i += BATCH_SIZE) {
                const batch = curseForgeSlugs.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (slug) => {
                    const id = await resolveCurseForgeSlug(slug);
                    if (id) {
                        curseForgeSlugToIdMap.set(slug, id);
                    }
                }));
                // Optional: add a small delay between batches if needed
                // await new Promise(resolve => setTimeout(resolve, 200));
            }

            const curseForgeIds = Array.from(curseForgeSlugToIdMap.values());

            if (curseForgeIds.length > 0) {
                const projects = await fetchCurseForgeMods(curseForgeIds);
                projects.forEach(p => {
                    curseForgeProjectsMap.set(p.id, p);
                });
            }
        }
    }

    // Assemble mods and separate them
    const modrinthMods: UnifiedMod[] = [];
    const curseForgeMods: UnifiedMod[] = [];
    const otherMods: UnifiedMod[] = [];
    const specialMods: UnifiedMod[] = [];

    for (const entry of finalEntries) {
        const project = entry.modrinthId ? modrinthProjectsMap.get(entry.modrinthId) : null;

        const curseForgeId = entry.curseforgeSlug ? curseForgeSlugToIdMap.get(entry.curseforgeSlug) : null;
        const cfProject = curseForgeId ? curseForgeProjectsMap.get(curseForgeId) : null;

        // Determine if it's special (datapack, plugin, etc.)
        let effectiveType = entry.projectType;
        if (project?.project_type && project.project_type !== 'mod') {
            effectiveType = project.project_type;
        } else if (cfProject) {
            // Mapping CurseForge class IDs to types
            if (cfProject.classId === 12) effectiveType = 'resourcepack';
            else if (cfProject.classId === 6945) effectiveType = 'datapack';
            else if (cfProject.classId === 4552) effectiveType = 'shader';
            else if (cfProject.classId === 5) effectiveType = 'plugin';
            // Add more as needed
        }

        const isSpecial = effectiveType !== 'mod';

        if (project) {
            // Re-apply Vanilla Tweaks override if applicable
            const isVanillaTweaks = entry.modName.toLowerCase().includes('vanilla tweaks') ||
                project.title.toLowerCase().includes('vanilla tweaks');

            const unified: UnifiedMod = {
                name: project.title,
                description: project.description,
                iconUrl: project.icon_url,
                modrinthId: project.id,
                curseforgeId: curseForgeId,
                links: entry.links,
                projectType: effectiveType,
                isArchived: entry.isArchived || project.status === 'archived',
                downloads: project.downloads,
                updated: project.updated,
                websiteUrl: `https://modrinth.com/${project.project_type}/${project.slug}`,
                categories: entry.categories,
                subcategories: entry.subcategories,
                notes: entry.notes,
                support: isVanillaTweaks ? {
                    forge1201: true,
                    fabric1201: true,
                    neoforge1211: true,
                    fabric1211: true
                } : {
                    forge1201: checkSupport(project, 'forge', '1.20.1', effectiveType),
                    fabric1201: checkSupport(project, 'fabric', '1.20.1', effectiveType),
                    neoforge1211: checkSupport(project, 'neoforge', '1.21.1', effectiveType),
                    fabric1211: checkSupport(project, 'fabric', '1.21.1', effectiveType)
                }
            };
            if (isSpecial) {
                specialMods.push(unified);
            } else {
                modrinthMods.push(unified);
            }
        } else if (cfProject) {
            // Re-apply Vanilla Tweaks override if applicable
            const isVanillaTweaks = entry.modName.toLowerCase().includes('vanilla tweaks') ||
                cfProject.name.toLowerCase().includes('vanilla tweaks');

            const unified: UnifiedMod = {
                name: cfProject.name,
                description: cfProject.summary,
                iconUrl: cfProject.logo?.thumbnailUrl || cfProject.logo?.url || null,
                modrinthId: null,
                curseforgeId: cfProject.id,
                links: entry.links,
                projectType: effectiveType,
                isArchived: entry.isArchived || cfProject.status === 6,
                downloads: cfProject.downloadCount,
                updated: cfProject.dateModified,
                websiteUrl: cfProject.links.websiteUrl,
                categories: entry.categories,
                subcategories: entry.subcategories,
                notes: entry.notes,
                support: isVanillaTweaks ? {
                    forge1201: true,
                    fabric1201: true,
                    neoforge1211: true,
                    fabric1211: true
                } : {
                    forge1201: checkCurseForgeSupport(cfProject, 'forge', '1.20.1', effectiveType === 'resourcepack' || effectiveType === 'datapack'),
                    fabric1201: checkCurseForgeSupport(cfProject, 'fabric', '1.20.1', effectiveType === 'resourcepack' || effectiveType === 'datapack'),
                    neoforge1211: checkCurseForgeSupport(cfProject, 'neoforge', '1.21.1', effectiveType === 'resourcepack' || effectiveType === 'datapack'),
                    fabric1211: checkCurseForgeSupport(cfProject, 'fabric', '1.21.1', effectiveType === 'resourcepack' || effectiveType === 'datapack')
                }
            };
            if (isSpecial) {
                specialMods.push(unified);
            } else {
                curseForgeMods.push(unified);
            }
        } else {
            const unified: UnifiedMod = {
                name: entry.modName,
                description: entry.description,
                iconUrl: null,
                modrinthId: null,
                curseforgeId: curseForgeId,
                links: entry.links,
                projectType: entry.projectType,
                isArchived: entry.isArchived,
                categories: entry.categories,
                subcategories: entry.subcategories,
                notes: entry.notes,
                support: entry.support
            };
            if (isSpecial) {
                specialMods.push(unified);
            } else {
                otherMods.push(unified);
            }
        }
    }

    // Sort by downloads descending, with alphabetical fallback
    const sortByDownloads = (a: UnifiedMod, b: UnifiedMod) => {
        const da = a.downloads ?? -1;
        const db = b.downloads ?? -1;
        if (da !== db) return db - da;
        return a.name.localeCompare(b.name);
    };

    const regularMods = [...modrinthMods, ...curseForgeMods, ...otherMods];
    regularMods.sort(sortByDownloads);
    specialMods.sort(sortByDownloads);

    const finalMods = [...regularMods, ...specialMods];

    const availableCategories = sheets.map(s => ({
        name: s.name,
        subcategories: Array.from(new Set(
            s.rows.map(r => getDelimiter(r, s.fields)).filter((d): d is string => d !== null)
        ))
    }));

    return (
        <main
            className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900 dark:selection:text-orange-100">
            <div
                className="mx-auto px-4 py-12 w-full max-w-7xl min-[1921px]:max-w-360 min-[2500px]:max-w-440 min-[3200px]:max-w-520">
                <header className="mb-10 text-center">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-5">
                        Epicraft <span
                        className="bg-linear-to-r from-orange-600 to-rose-600 dark:from-orange-500 dark:to-rose-500 bg-clip-text text-transparent">Mod Explorer</span>
                    </h1>
                    <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        The entries below are mods
                        that were suggested by the community for Epicraft 2.0, and have been added here so that everyone
                        can quickly and simply read about them via the Modrinth and Curseforge APIs.
                    </p>
                </header>

                <section className="animate-slide-up">
                    <ModListClient mods={finalMods} availableCategories={availableCategories}/>
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
