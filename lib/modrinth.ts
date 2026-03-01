export interface ModrinthProject {
    id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    client_side: string;
    server_side: string;
    game_versions: string[];
    loaders: string[];
    icon_url: string | null;
    source_url: string | null;
    issues_url: string | null;
    wiki_url: string | null;
    discord_url: string | null;
    project_type: string;
    status: string;
    downloads: number;
    updated: string;
}


export interface ModrinthDependency {
    projects: ModrinthProject[];
    versions: {
        id: string;
        project_id: string;
        dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
    }[];
}

export interface ModrinthProjectVersion {
    id: string;
    project_id: string;
    name: string;
    version_number: string;
    game_versions: string[];
    loaders: string[];
    dependencies: {
        project_id: string | null;
        version_id: string | null;
        dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
    }[];
}

/**
 * Default revalidation period for Modrinth API results (7 days)
 */
const DEFAULT_MODRINTH_REVALIDATE = 604800;

/**
 * Common headers for Modrinth API requests
 */
const MODRINTH_HEADERS = {
    'User-Agent': 'epicraft-csv-viewer (https://github.com/Tyrthurey/epicraft-csv-viewer)'
};

/**
 * Get the revalidation period for Modrinth API calls
 */
function getRevalidate(): number {
    return parseInt(process.env.MODRINTH_REVALIDATE || String(DEFAULT_MODRINTH_REVALIDATE));
}

/**
 * Fetches all dependencies for a Modrinth project.
 *
 * @param idOrSlug - The ID or slug of the Modrinth project
 * @returns An object containing project and version dependency data, or null on failure
 *
 * @example
 * ```ts
 * const deps = await fetchModrinthDependencies('fabric-api');
 * if (deps) {
 *   console.log(deps.projects.map(p => p.title));
 * }
 * ```
 */
export async function fetchModrinthDependencies(idOrSlug: string): Promise<ModrinthDependency | null> {
    const url = `https://api.modrinth.com/v2/project/${idOrSlug}/dependencies`;
    const revalidate = getRevalidate();

    try {
        const res = await fetch(url, {
            headers: MODRINTH_HEADERS,
            next: {revalidate}
        });

        if (res.ok) {
            return await res.json();
        }

        if (res.status === 429) {
            console.warn(`[Server] Modrinth API rate limit hit while fetching dependencies for ${idOrSlug}`);
        } else {
            const errorBody = await res.text().catch(() => '');
            console.error(`Modrinth Dependency API error for ${idOrSlug}: ${res.status} ${res.statusText} - ${errorBody}`);
        }
    } catch (err) {
        console.error(`Modrinth dependency fetch error for ${idOrSlug}:`, err);
    }

    return null;
}

/**
 * Fetches all versions of a Modrinth project.
 *
 * @param idOrSlug - The ID or slug of the Modrinth project
 * @returns An array of project versions
 *
 * @example
 * ```ts
 * const versions = await fetchModrinthProjectVersions('sodium');
 * const fabric1201Versions = versions.filter(v => 
 *   v.game_versions.includes('1.20.1') && v.loaders.includes('fabric')
 * );
 * ```
 */
export async function fetchModrinthProjectVersions(idOrSlug: string): Promise<ModrinthProjectVersion[]> {
    const url = `https://api.modrinth.com/v2/project/${idOrSlug}/version`;
    const revalidate = getRevalidate();

    try {
        const res = await fetch(url, {
            headers: MODRINTH_HEADERS,
            next: {revalidate}
        });

        if (res.ok) {
            return await res.json();
        }

        if (res.status === 429) {
            console.warn(`[Server] Modrinth API rate limit hit while fetching versions for ${idOrSlug}`);
        } else {
            const errorBody = await res.text().catch(() => '');
            console.error(`Modrinth versions API error for ${idOrSlug}: ${res.status} ${res.statusText} - ${errorBody}`);
        }
    } catch (err) {
        console.error(`Modrinth versions fetch error for ${idOrSlug}:`, err);
    }

    return [];
}

/**
 * Fetches multiple Modrinth projects by their IDs in bulk.
 *
 * @param ids - Array of Modrinth project IDs
 * @returns An array of Modrinth project data
 */
export async function fetchModrinthProjects(ids: string[]): Promise<ModrinthProject[]> {
    if (ids.length === 0) return [];

    const url = `https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`;
    const revalidate = getRevalidate();

    try {
        const res = await fetch(url, {
            headers: MODRINTH_HEADERS,
            next: {revalidate}
        });

        if (res.ok) {
            return await res.json() as ModrinthProject[];
        }

        if (res.status === 429) {
            console.warn(`[Server] Modrinth API rate limit hit during bulk project fetch`);
        } else {
            const errorBody = await res.text().catch(() => '');
            console.error(`Modrinth bulk project API error: ${res.status} ${res.statusText} - ${errorBody}`);
        }
    } catch (err) {
        console.error('Modrinth fetch error:', err);
    }

    return [];
}

export function checkSupport(project: ModrinthProject, loader: string, version: string, typeOverride?: string): boolean {
    const hasVersion = project.game_versions.some(v => v === version);
    if (!hasVersion) return false;

    const type = typeOverride || project.project_type;
    // Resourcepacks and datapacks are compatible with all modloaders for their MC version
    if (type === 'resourcepack' || type === 'datapack') {
        return true;
    }

    return project.loaders.some(l => l.toLowerCase() === loader.toLowerCase());
}
