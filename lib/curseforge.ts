/**
 * CurseForge Mod data structure as returned by the API
 */
export interface CurseForgeMod {
    id: number;
    name: string;
    summary: string;
    slug: string;
    status: number;
    logo: {
        thumbnailUrl: string;
        url: string;
    };
    links: {
        websiteUrl: string;
    };
    downloadCount: number;
    dateModified: string;
    classId: number;
    /**
     * Simplified index of the latest files for each game version and mod loader combination.
     * Useful for quick support checks without inspecting the full file objects.
     */
    latestFilesIndexes: {
        gameVersion: string;
        modLoader: number;
        fileId: number;
    }[];
    /**
     * Detailed metadata for the most recently uploaded files.
     * Includes dependency information and specific game version tags.
     */
    latestFiles: {
        id: number;
        displayName: string;
        fileName: string;
        gameVersions: string[];
        dependencies: {
            modId: number;
            relationType: number;
        }[];
    }[];
}

const MINECRAFT_GAME_ID = 432;

/**
 * Default revalidation period for slug resolution (30 days)
 */
const DEFAULT_SLUG_REVALIDATE = 2592000;

/**
 * Default revalidation period for mod data cache (24 hours)
 */
const DEFAULT_MOD_CACHE_TTL = 86400;

/**
 * Maximum number of mods to keep in memory cache
 */
const MAX_MOD_CACHE_SIZE = 5000;

/**
 * In-memory cache for bulk mod requests.
 * Includes a TTL-based eviction and maximum size to prevent unbounded memory usage.
 */
const modCache = new Map<number, { mod: CurseForgeMod; timestamp: number }>();

function getModCacheTtl(): number {
    const ttl = parseInt(process.env.CURSEFORGE_MOD_CACHE_TTL || String(DEFAULT_MOD_CACHE_TTL));
    return ttl * 1000; // convert to ms
}

export function getCurseForgeApiKey(): string | undefined {
    const apiKey = process.env.CURSEFORGE_API_KEY;
    if (!apiKey) return undefined;

    // Auto-fix: if the key contains literal \$ it was likely over-escaped or 
    // placed in single quotes in an environment that doesn't strip backslashes
    if (apiKey.includes('\\$')) {
        return apiKey.replace(/\\\$/g, '$');
    }

    return apiKey;
}

export async function fetchCurseForgeMods(ids: number[]): Promise<CurseForgeMod[]> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
        console.warn('[Server] CurseForge API key missing in fetchCurseForgeMods');
        return [];
    }
    if (ids.length === 0) return [];

    const allProjects: CurseForgeMod[] = [];
    const idsToFetch: number[] = [];

    const now = Date.now();
    const ttl = getModCacheTtl();

    // Check cache first to avoid redundant API calls
    for (const id of ids) {
        const entry = modCache.get(id);
        if (entry && (now - entry.timestamp < ttl)) {
            allProjects.push(entry.mod);
        } else {
            if (entry) modCache.delete(id); // Clean up expired entry
            idsToFetch.push(id);
        }
    }

    if (idsToFetch.length === 0) return allProjects;

    const chunks: number[][] = [];
    for (let i = 0; i < idsToFetch.length; i += 100) {
        chunks.push(idsToFetch.slice(i, i + 100));
    }

    for (const chunk of chunks) {
        const url = 'https://api.curseforge.com/v1/mods';
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify({
                    modIds: chunk,
                    filterPcOnly: true
                }),
            });

            if (res.ok) {
                const result = await res.json();
                const data = result.data as CurseForgeMod[];
                const setTimestamp = Date.now();

                for (const mod of data) {
                    // Evict oldest if full (and if we're adding a new entry)
                    if (modCache.size >= MAX_MOD_CACHE_SIZE && !modCache.has(mod.id)) {
                        const firstKey = modCache.keys().next().value;
                        if (firstKey !== undefined) modCache.delete(firstKey);
                    }
                    modCache.set(mod.id, {mod, timestamp: setTimestamp});
                }
                allProjects.push(...data);
            } else {
                const errorBody = await res.text().catch(() => '');
                console.error(`CurseForge API error: ${res.status} ${res.statusText} - ${errorBody}`);
            }
        } catch (err) {
            console.error('CurseForge fetch error:', err);
        }
    }

    return allProjects;
}

export async function resolveCurseForgeSlug(slug: string): Promise<number | null> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
        console.warn(`[Server] CurseForge API key missing in resolveCurseForgeSlug for ${slug}`);
        return null;
    }

    // Using gameId=432 (Minecraft) and slug to find the mod
    const url = `https://api.curseforge.com/v1/mods/search?gameId=${MINECRAFT_GAME_ID}&slug=${slug}`;
    try {
        const revalidate = parseInt(process.env.CURSEFORGE_SLUG_REVALIDATE || String(DEFAULT_SLUG_REVALIDATE));
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'x-api-key': apiKey,
            },
            next: {revalidate}
        });

        if (res.ok) {
            const result = await res.json();
            if (result.data && result.data.length > 0) {
                return result.data[0].id;
            }
        } else {
            const errorBody = await res.text().catch(() => '');
            console.error(`CurseForge slug resolution failed for ${slug}: ${res.status} ${res.statusText} - ${errorBody}`);
        }
    } catch (err) {
        console.error(`Error resolving CurseForge slug ${slug}:`, err);
    }
    return null;
}

export function checkCurseForgeSupport(mod: CurseForgeMod, loader: string, version: string, isUniversalOverride?: boolean): boolean {
    const hasVersion = mod.latestFilesIndexes.some(f => f.gameVersion === version);
    if (!hasVersion) return false;

    // Resourcepacks (12) and datapacks (6945) are compatible with all modloaders
    if (isUniversalOverride || mod.classId === 12 || mod.classId === 6945) {
        return true;
    }

    // modLoader mapping: 1 = Forge, 2 = Cauldron, 3 = LiteLoader, 4 = Fabric, 5 = Quilt, 6 = NeoForge
    const loaderMap: Record<string, number> = {
        'forge': 1,
        'fabric': 4,
        'quilt': 5,
        'neoforge': 6
    };

    const targetLoader = loaderMap[loader.toLowerCase()];
    if (!targetLoader) return false;

    return mod.latestFilesIndexes.some(f =>
        f.gameVersion === version &&
        (f.modLoader === targetLoader || f.modLoader === 0)
    );
}
