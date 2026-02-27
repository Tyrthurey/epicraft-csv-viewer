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

export async function fetchModrinthProjects(ids: string[]): Promise<ModrinthProject[]> {
    if (ids.length === 0) return [];

    // Modrinth API allows bulk fetching
    // We should chunk it if there are too many, but for now let's assume it's reasonable
    // The limit is usually around 100 IDs per request for some APIs, Modrinth might have one too.

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
        chunks.push(ids.slice(i, i + 100));
    }

    const allProjects: ModrinthProject[] = [];

    for (const chunk of chunks) {
        const url = `https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(chunk))}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'epicraft-csv-viewer (https://github.com/Tyrthurey/epicraft-csv-viewer)'
                }
            });
            if (res.ok) {
                const data = await res.json();
                allProjects.push(...data);
            } else {
                console.error(`Modrinth API error: ${res.status} ${res.statusText}`);
            }
        } catch (err) {
            console.error('Modrinth fetch error:', err);
        }
    }

    return allProjects;
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
