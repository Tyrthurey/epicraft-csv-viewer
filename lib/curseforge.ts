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
    latestFilesIndexes: {
        gameVersion: string;
        modLoader: number;
    }[];
}

const MINECRAFT_GAME_ID = 432;

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

    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
        chunks.push(ids.slice(i, i + 100));
    }

    const allProjects: CurseForgeMod[] = [];

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
                allProjects.push(...result.data);
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
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'x-api-key': apiKey,
            }
        });

        if (res.ok) {
            const result = await res.json();
            if (result.data && result.data.length > 0) {
                return result.data[0].id;
            }
        } else {
            const errorBody = await res.text().catch(() => '');
            console.error(`CurseForge slug resolution failed for ${slug}: ${res.status} ${res.statusText} - ${errorBody}`);
            if (res.status === 429) {
                console.warn('CurseForge API rate limited');
            }
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
