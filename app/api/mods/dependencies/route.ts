import {NextRequest, NextResponse} from "next/server";
import {
    fetchModrinthProjectVersions,
    fetchModrinthProjects,
} from "@/lib/modrinth";
import {fetchCurseForgeMods} from "@/lib/curseforge";

export async function GET(request: NextRequest) {
    const {searchParams} = new URL(request.url);
    const modrinthIds =
        searchParams
            .get("modrinthIds")
            ?.split(",")
            .filter((id) => !!id) || [];
    const curseforgeIds =
        searchParams
            .get("curseforgeIds")
            ?.split(",")
            .filter((id) => !!id)
            .map((id) => parseInt(id))
            .filter((id) => !isNaN(id)) || [];

    const targets = [
        {loader: "fabric", version: "1.20.1", id: "fabric_1_20_1"},
        {loader: "forge", version: "1.20.1", id: "forge_1_20_1"},
        {loader: "fabric", version: "1.21.1", id: "fabric_1_21_1"},
        {loader: "neoforge", version: "1.21.1", id: "neoforge_1_21_1"},
    ];

    const result: Record<
        string,
        Record<
            string,
            {
                required: { name: string; url: string }[];
                optional: { name: string; url: string }[];
            }
        >
    > = {};

    // Process Modrinth
    if (modrinthIds.length > 0) {
        // 1. Fetch all project versions with rate limiting to avoid hitting API limits
        // Process sequentially with small delays instead of parallel to respect rate limits
        const allProjectVersions: {
            id: string;
            versions: import("@/lib/modrinth").ModrinthProjectVersion[];
        }[] = [];

        for (let i = 0; i < modrinthIds.length; i++) {
            const id = modrinthIds[i];
            try {
                // Add small delay between requests to avoid rate limiting (except for first request)
                const delayMs = i > 0 ? 100 : 0;
                // Use noCache for version fetching to avoid large response cache errors
                const versions = await fetchModrinthProjectVersions(id, {
                    delayMs,
                    noCache: true,
                });
                allProjectVersions.push({id, versions});
            } catch (e) {
                console.error(`Failed to fetch versions for modrinth mod ${id}:`, e);
                allProjectVersions.push({id, versions: []});
            }
        }

        // 2. Collect all unique dependency project IDs across all mods and targets
        const allDepProjectIds = new Set<string>();
        allProjectVersions.forEach(({versions}) => {
            versions.forEach((v) => {
                // We only care about versions matching our targets to keep bulk fetch small
                const isRelevant = targets.some(
                    (t) =>
                        v.game_versions.includes(t.version) &&
                        v.loaders.some((l) => l.toLowerCase() === t.loader),
                );
                if (isRelevant) {
                    v.dependencies.forEach((d) => {
                        if (d.project_id) allDepProjectIds.add(d.project_id);
                    });
                }
            });
        });

        // 3. Fetch all dependency projects in ONE bulk call
        const depProjects = await fetchModrinthProjects(
            Array.from(allDepProjectIds),
        );
        const projectMap = new Map(depProjects.map((p) => [p.id, p]));

        // 4. Map back to results
        for (const {id, versions} of allProjectVersions) {
            const modResult: Record<
                string,
                {
                    required: { name: string; url: string }[];
                    optional: { name: string; url: string }[];
                }
            > = {};

            for (const target of targets) {
                const matchingVersions = versions.filter(
                    (v) =>
                        v.game_versions.includes(target.version) &&
                        v.loaders.some((l) => l.toLowerCase() === target.loader),
                );

                const latest = matchingVersions[0];
                const targetDeps: {
                    required: { name: string; url: string }[];
                    optional: { name: string; url: string }[];
                } = {required: [], optional: []};

                if (latest) {
                    latest.dependencies.forEach((d) => {
                        if (!d.project_id) return;
                        const p = projectMap.get(d.project_id);
                        if (!p) return;

                        const depData = {
                            name: p.title,
                            url: `https://modrinth.com/${p.project_type}/${p.slug}`,
                        };

                        if (d.dependency_type === "required") {
                            targetDeps.required.push(depData);
                        } else if (d.dependency_type === "optional") {
                            targetDeps.optional.push(depData);
                        }
                    });
                }
                modResult[target.id] = targetDeps;
            }
            result[`modrinth_${id}`] = modResult;
        }
    }

    // Process CurseForge
    if (curseforgeIds.length > 0) {
        const mods = await fetchCurseForgeMods(curseforgeIds);
        const cfLoaderMap: Record<string, number> = {
            forge: 1,
            fabric: 4,
            neoforge: 6,
        };

        // 1. Collect all unique dependency mod IDs across all mods and targets
        const allDepModIds = new Set<number>();
        for (const mod of mods) {
            for (const target of targets) {
                const targetLoaderId = cfLoaderMap[target.loader];
                const matchingFiles = mod.latestFiles.filter(
                    (f) =>
                        f.gameVersions.includes(target.version) &&
                        mod.latestFilesIndexes.some(
                            (idx) =>
                                idx.gameVersion === target.version &&
                                (idx.modLoader === targetLoaderId || idx.modLoader === 0),
                        ) &&
                        f.gameVersions.some((gv) => {
                            if (target.loader === "fabric")
                                return gv.toLowerCase() === "fabric";
                            if (target.loader === "forge")
                                return gv.toLowerCase() === "forge";
                            if (target.loader === "neoforge")
                                return gv.toLowerCase() === "neoforge";
                            return false;
                        }),
                );

                let file = matchingFiles[0];
                if (!file) {
                    const idx = mod.latestFilesIndexes.find(
                        (i) =>
                            i.gameVersion === target.version &&
                            (i.modLoader === targetLoaderId || i.modLoader === 0),
                    );
                    if (idx) {
                        // @ts-expect-error - file can be undefined if find fails
                        file = mod.latestFiles.find((f) => f.id === idx.fileId);
                    }
                }

                if (file) {
                    file.dependencies.forEach((d) => allDepModIds.add(d.modId));
                }
            }
        }

        // 2. Fetch all dependency mods in ONE bulk call
        const allDepMods = await fetchCurseForgeMods(Array.from(allDepModIds));
        const depModMap = new Map(allDepMods.map((m) => [m.id, m]));

        // 3. Map back to results
        for (const mod of mods) {
            const modResult: Record<
                string,
                {
                    required: { name: string; url: string }[];
                    optional: { name: string; url: string }[];
                }
            > = {};

            for (const target of targets) {
                // Find the correct file for this target (same logic as ID collection)
                const targetLoaderId = cfLoaderMap[target.loader];
                const matchingFiles = mod.latestFiles.filter(
                    (f) =>
                        f.gameVersions.includes(target.version) &&
                        mod.latestFilesIndexes.some(
                            (idx) =>
                                idx.gameVersion === target.version &&
                                (idx.modLoader === targetLoaderId || idx.modLoader === 0),
                        ) &&
                        f.gameVersions.some((gv) => {
                            if (target.loader === "fabric")
                                return gv.toLowerCase() === "fabric";
                            if (target.loader === "forge")
                                return gv.toLowerCase() === "forge";
                            if (target.loader === "neoforge")
                                return gv.toLowerCase() === "neoforge";
                            return false;
                        }),
                );

                let file = matchingFiles[0];
                if (!file) {
                    const idx = mod.latestFilesIndexes.find(
                        (i) =>
                            i.gameVersion === target.version &&
                            (i.modLoader === targetLoaderId || i.modLoader === 0),
                    );
                    if (idx) {
                        // @ts-expect-error - file can be undefined if find fails
                        file = mod.latestFiles.find((f) => f.id === idx.fileId);
                    }
                }

                const targetDeps: {
                    required: { name: string; url: string }[];
                    optional: { name: string; url: string }[];
                } = {required: [], optional: []};
                if (file) {
                    file.dependencies.forEach((d) => {
                        const dm = depModMap.get(d.modId);
                        if (!dm) return;

                        const depData = {
                            name: dm.name,
                            url: dm.links.websiteUrl,
                        };

                        if (
                            d.relationType === 3 ||
                            d.relationType === 1 ||
                            d.relationType === 6
                        ) {
                            targetDeps.required.push(depData);
                        } else {
                            targetDeps.optional.push(depData);
                        }
                    });
                }
                modResult[target.id] = targetDeps;
            }
            result[`curseforge_${mod.id}`] = modResult;
        }
    }

    return NextResponse.json(result);
}
