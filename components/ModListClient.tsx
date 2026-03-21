"use client";
import React, { useMemo, useState } from "react";

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
  recommended: boolean;
  default: boolean;
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

// Only NeoForge 1.21.1 for dependencies
const TARGET_ID = "neoforge_1_21_1";

const safeStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("localStorage access failed:", e);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("localStorage access failed:", e);
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("localStorage access failed:", e);
    }
  },
};

const ModDependencies = ({
  modDeps,
  isCompact,
}: {
  modDeps: Record<
    string,
    {
      required: { name: string; url: string }[];
      optional: { name: string; url: string }[];
    }
  >;
  isCompact: boolean;
}) => {
  const deps = modDeps[TARGET_ID];

  if (!deps || (deps.required.length === 0 && deps.optional.length === 0)) {
    return null;
  }

  const hasRequired = deps.required.length > 0;
  const hasOptional = deps.optional.length > 0;

  return (
    <div
      className={`mt-3 space-y-2 pt-3 border-t border-gray-100/50 dark:border-gray-700/50 ${isCompact ? "text-[9px]" : "text-[10px]"}`}
    >
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div className="font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
          Dependencies
        </div>
        {(hasRequired || hasOptional) && (
          <div className="flex flex-wrap gap-x-2 text-[8px] font-bold uppercase tracking-wider opacity-60 mr-2">
            {hasRequired && (
              <span className="text-rose-600 dark:text-rose-400 whitespace-nowrap">
                Red = Required
              </span>
            )}
            {hasOptional && (
              <span className="text-amber-600 dark:text-amber-400 whitespace-nowrap">
                Orange = Optional
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dependencies List */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {deps.required.map((dep) => (
          <a
            key={`req-${dep.url}`}
            href={dep.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap"
          >
            {dep.name}
          </a>
        ))}
        {deps.optional.map((dep) => (
          <a
            key={`opt-${dep.url}`}
            href={dep.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap"
          >
            {dep.name}
          </a>
        ))}
      </div>
    </div>
  );
};

const TagBadge = ({
  label,
  active,
  isCompact,
  variant,
}: {
  label: string;
  active: boolean;
  isCompact?: boolean;
  variant: "recommended" | "default";
}) => {
  if (!active) return null;

  const styles =
    variant === "recommended"
      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
      : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg font-bold uppercase tracking-wider border shrink-0 transition-all ${isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[10px]"} ${styles}`}
    >
      <span>{isCompact ? label.charAt(0) : label}</span>
    </div>
  );
};

function formatDownloads(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ModListClient({
  mods = [],
  availableCategories = [],
}: {
  mods: UnifiedMod[];
  availableCategories?: CategoryInfo[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isDependencyView, setIsDependencyView] = useState(false);
  const [dependencies, setDependencies] = useState<
    Record<
      string,
      Record<
        string,
        {
          required: { name: string; url: string }[];
          optional: { name: string; url: string }[];
        }
      >
    >
  >({});
  const [loadingDeps, setLoadingDeps] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for use in effects to avoid unnecessary re-triggers
  const dependenciesRef = React.useRef(dependencies);
  dependenciesRef.current = dependencies;
  const loadingDepsRef = React.useRef(loadingDeps);
  loadingDepsRef.current = loadingDeps;

  // Load from localStorage on mount
  React.useEffect(() => {
    const compact = safeStorage.getItem("epicraft_isCompact") === "true";
    const depView = safeStorage.getItem("epicraft_isDependencyView") === "true";
    const deps = safeStorage.getItem("epicraft_dependencies");

    if (compact) setIsCompact(true);
    if (depView) setIsDependencyView(true);
    if (deps) {
      try {
        setDependencies(JSON.parse(deps));
      } catch (e) {
        console.error("Failed to parse dependencies from storage", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save preferences and dependencies to localStorage
  React.useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem("epicraft_isCompact", String(isCompact));
    }
  }, [isCompact, isLoaded]);

  React.useEffect(() => {
    if (isLoaded) {
      safeStorage.setItem(
        "epicraft_isDependencyView",
        String(isDependencyView),
      );
    }
  }, [isDependencyView, isLoaded]);

  React.useEffect(() => {
    if (isLoaded && Object.keys(dependencies).length > 0) {
      safeStorage.setItem(
        "epicraft_dependencies",
        JSON.stringify(dependencies),
      );
    }
  }, [dependencies, isLoaded]);

  React.useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    const fetchDeps = async () => {
      const currentDeps = dependenciesRef.current;
      const currentLoading = loadingDepsRef.current;
      const toFetch = mods.filter((m) => {
        const id = m.modrinthId
          ? `modrinth_${m.modrinthId}`
          : `curseforge_${m.curseforgeId}`;
        return (
          (m.modrinthId !== null || m.curseforgeId !== null) &&
          !currentDeps[id] &&
          !currentLoading.has(id)
        );
      });

      if (toFetch.length === 0) return;

      const modrinthIds: string[] = [];
      const curseforgeIds: number[] = [];

      toFetch.forEach((m) => {
        if (m.modrinthId) {
          modrinthIds.push(m.modrinthId);
        } else if (m.curseforgeId) {
          curseforgeIds.push(m.curseforgeId);
        }
      });

      const modrinthChunks = [];
      for (let i = 0; i < modrinthIds.length; i += 10)
        modrinthChunks.push(modrinthIds.slice(i, i + 10));

      const curseforgeChunks = [];
      for (let i = 0; i < curseforgeIds.length; i += 10)
        curseforgeChunks.push(curseforgeIds.slice(i, i + 10));

      setLoadingDeps((prev) => {
        const next = new Set(prev);
        toFetch.forEach((m) => {
          const id = m.modrinthId
            ? `modrinth_${m.modrinthId}`
            : `curseforge_${m.curseforgeId}`;
          next.add(id);
        });
        return next;
      });

      try {
        for (const chunk of modrinthChunks) {
          try {
            const res = await fetch(
              `/api/mods/dependencies?modrinthIds=${chunk.join(",")}`,
              {
                signal: controller.signal,
              },
            );
            if (res.ok) {
              const data = await res.json();
              setDependencies((prev) => ({ ...prev, ...data }));
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.name !== "AbortError") {
              console.error(e);
            }
          }
        }

        for (const chunk of curseforgeChunks) {
          try {
            const res = await fetch(
              `/api/mods/dependencies?curseforgeIds=${chunk.join(",")}`,
              {
                signal: controller.signal,
              },
            );
            if (res.ok) {
              const data = await res.json();
              setDependencies((prev) => ({ ...prev, ...data }));
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.name !== "AbortError") {
              console.error(e);
            }
          }
        }
      } finally {
        setLoadingDeps((prev) => {
          const next = new Set(prev);
          toFetch.forEach((m) => {
            next.delete(
              m.modrinthId
                ? `modrinth_${m.modrinthId}`
                : `curseforge_${m.curseforgeId}`,
            );
          });
          return next;
        });
      }
    };

    fetchDeps();
    return () => controller.abort();
  }, [mods, isLoaded]);

  const clearDependencyCache = () => {
    if (confirm("Clear all cached dependency data?")) {
      setDependencies({});
      safeStorage.removeItem("epicraft_dependencies");
    }
  };

  const cachedCount = Object.keys(dependencies).length;

  const filteredMods = useMemo(() => {
    let result = mods;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          m.description.toLowerCase().includes(s) ||
          (m.projectType && m.projectType.toLowerCase().includes(s)) ||
          (m.isArchived && "archived".includes(s)) ||
          m.links.some(
            (l) =>
              l.label.toLowerCase().includes(s) ||
              l.url.toLowerCase().includes(s),
          ),
      );
    }

    if (categoryFilter) {
      result = result.filter((m) => m.categories?.includes(categoryFilter));
    }

    return result;
  }, [mods, search, categoryFilter]);

  const sortModsByPriority = (mods: UnifiedMod[]) => {
    return [...mods].sort((a, b) => {
      // First sort by priority: recommended (3) > untagged (2) > default (1)
      const getPriority = (mod: UnifiedMod) => {
        if (mod.recommended) return 3;
        if (mod.default) return 1;
        return 2;
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // Within same priority, place special types (shader, resourcepack, plugin, datapack) at the end
      const isSpecialType = (mod: UnifiedMod) => {
        const type = mod.projectType?.toLowerCase() || "mod";
        return type !== "mod";
      };

      const specialA = isSpecialType(a);
      const specialB = isSpecialType(b);

      if (specialA !== specialB) {
        return specialA ? 1 : -1; // Special types go to the end
      }

      // Within same type category, sort by downloads (descending)
      const downloadsA = a.downloads ?? -1;
      const downloadsB = b.downloads ?? -1;
      if (downloadsA !== downloadsB) {
        return downloadsB - downloadsA;
      }

      // Fallback to name
      return a.name.localeCompare(b.name);
    });
  };

  const groupedMods = useMemo(() => {
    if (categoryFilter) {
      const catInfo = availableCategories.find(
        (c) => c.name === categoryFilter,
      );
      const subOrder = catInfo?.subcategories || [];

      const groups: Record<string, UnifiedMod[]> = {};
      const others: UnifiedMod[] = [];

      filteredMods.forEach((mod) => {
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
        result.push({ name: "General", mods: sortModsByPriority(others) });
      }

      subOrder.forEach((sub) => {
        if (groups[sub]) {
          result.push({ name: sub, mods: sortModsByPriority(groups[sub]) });
        }
      });

      return result;
    }

    return [{ name: null, mods: sortModsByPriority(filteredMods) }];
  }, [filteredMods, categoryFilter, availableCategories]);

  const renderClickableText = (val: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = val.split(urlRegex);
    let counter = 0;
    return parts.map((part) => {
      const key = urlRegex.test(part)
        ? `link-${part}`
        : `text-${part}-${counter++}`;
      return urlRegex.test(part) ? (
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-orange-600 dark:text-orange-400 decoration-orange-300 dark:decoration-orange-700 underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400 transition-colors break-all"
        >
          {part}
        </a>
      ) : (
        <React.Fragment key={key}>{part}</React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-8">
          {availableCategories.map((cat) => (
            <button
              type="button"
              key={cat.name}
              onClick={() =>
                setCategoryFilter(categoryFilter === cat.name ? null : cat.name)
              }
              className={`cursor-pointer px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                categoryFilter === cat.name
                  ? "bg-linear-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200/50 dark:shadow-orange-900/50"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-gray-700"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-label="Search"
              >
                <title>Search icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCompact(!isCompact)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium whitespace-nowrap w-full md:w-auto justify-center cursor-pointer ${
              isCompact
                ? "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label="Compact view"
            >
              <title>Compact view icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
            Compact View
          </button>

          <button
            type="button"
            onClick={() => setIsDependencyView(!isDependencyView)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium whitespace-nowrap w-full md:w-auto justify-center cursor-pointer ${
              isDependencyView
                ? "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label="Dependency view"
            >
              <title>Dependency view icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Dependency View
          </button>

          {isDependencyView && cachedCount > 0 && (
            <button
              type="button"
              onClick={clearDependencyCache}
              className="flex items-center gap-2 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 cursor-pointer"
              title="Clear Dependency Cache"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-label="Clear cache"
              >
                <title>Clear cache icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
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
                <span className="text-orange-500">
                  Fetching {loadingDeps.size}...
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-12">
        {groupedMods.map((group) => (
          <div key={group.name ?? "all"} className="space-y-8">
            {group.name && (
              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 px-4 py-2 bg-linear-to-r from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 rounded-full border border-orange-200 dark:border-orange-800 whitespace-nowrap">
                  {group.name}
                </h2>
                <div className="flex-1 h-px bg-linear-to-r from-transparent via-orange-300 dark:via-orange-700 to-transparent"></div>
              </div>
            )}

            <div
              className={`grid gap-6 ${
                isCompact
                  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {group.mods.map((mod) => (
                <div
                  key={mod.name}
                  className={`group relative rounded-2xl border shadow-sm transition-all duration-200 hover:-translate-y-1 flex flex-col h-full ${
                    mod.recommended
                      ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-600/60 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.15)] dark:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.2)]"
                      : mod.default
                        ? "bg-blue-50/30 dark:bg-blue-950/20 border-blue-300 dark:border-blue-600/60 ring-1 ring-blue-200/50 dark:ring-blue-800/30 shadow-[0_2px_8px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_8px_-2px_rgba(59,130,246,0.2)]"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  } hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.15)] dark:hover:shadow-[6px_6px_20px_-2px_rgba(234,88,12,0.25)] hover:bg-orange-50/40 dark:hover:bg-gray-700/30 hover:border-orange-500/30 hover:ring-1 hover:ring-orange-500/20 ${
                    isCompact ? "p-3" : "p-6"
                  }`}
                >
                  {/* Top Right Tags */}
                  <div
                    className={`absolute top-0 right-0 flex gap-1 ${isCompact ? "p-1.5" : "p-2"}`}
                  >
                    <TagBadge
                      label="Recommended"
                      active={mod.recommended}
                      isCompact={isCompact}
                      variant="recommended"
                    />
                    <TagBadge
                      label="Default"
                      active={mod.default}
                      isCompact={isCompact}
                      variant="default"
                    />
                  </div>
                  <div
                    className={`flex items-start gap-4 ${isCompact ? "mb-2" : "mb-4"}`}
                  >
                    {mod.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className={`${isCompact ? "w-10 h-10 rounded-lg" : "w-16 h-16 rounded-xl"} object-cover`}
                      />
                    ) : (
                      <div
                        className={`${isCompact ? "w-10 h-10 rounded-lg" : "w-16 h-16 rounded-xl"} bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center overflow-hidden`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/epic.png"
                          alt="Epicraft"
                          className={`${isCompact ? "w-8 h-8" : "w-12 h-12"} object-contain`}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3
                          className={`${isCompact ? "text-sm font-semibold" : "text-lg font-bold"} text-gray-900 dark:text-white truncate flex-1 min-w-0`}
                        >
                          {mod.modrinthId ||
                          mod.curseforgeId ||
                          mod.links.length > 0 ||
                          mod.websiteUrl ? (
                            <a
                              href={
                                mod.websiteUrl ||
                                (mod.modrinthId
                                  ? `https://modrinth.com/mod/${mod.modrinthId}`
                                  : mod.curseforgeId
                                    ? `https://www.curseforge.com/projects/${mod.curseforgeId}`
                                    : mod.links[0]?.url)
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

                        {!isCompact && mod.isArchived && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                            Archived
                          </span>
                        )}
                      </div>
                      {!isCompact && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-10 mt-1">
                          {mod.description || "No description available."}
                        </p>
                      )}

                      {(mod.downloads !== undefined || mod.updated) && (
                        <div
                          className={`flex items-center flex-wrap ${isCompact ? "gap-2 mt-1" : "gap-3 mt-2"}`}
                        >
                          {mod.downloads !== undefined && (
                            <div
                              className={`inline-flex items-center gap-1 ${isCompact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]"} bg-orange-100/50 dark:bg-orange-900/30 border border-orange-200/50 dark:border-orange-800/50 rounded-md font-bold text-orange-700 dark:text-orange-400`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`${isCompact ? "h-2.5 w-2.5" : "h-3 w-3"}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-label="Downloads"
                              >
                                <title>Downloads icon</title>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              {formatDownloads(mod.downloads)}
                            </div>
                          )}
                          {mod.updated && (
                            <div
                              className={`flex items-center gap-1 ${isCompact ? "text-[9px] font-medium" : "text-[10px] font-semibold uppercase tracking-wider"} text-gray-500 dark:text-gray-400`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`${isCompact ? "h-2.5 w-2.5" : "h-3 w-3"}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-label="Last updated"
                              >
                                <title>Last updated icon</title>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {!isCompact && "Last updated: "}
                              {formatDate(mod.updated)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dependencies Section */}
                  {isDependencyView &&
                    (() => {
                      const depKey = mod.modrinthId
                        ? `modrinth_${mod.modrinthId}`
                        : mod.curseforgeId
                          ? `curseforge_${mod.curseforgeId}`
                          : null;
                      const modDeps = depKey ? dependencies[depKey] : null;
                      if (!modDeps) return null;
                      return (
                        <ModDependencies
                          modDeps={modDeps}
                          isCompact={isCompact}
                        />
                      );
                    })()}

                  {mod.notes && mod.notes.length > 0 && !isCompact && (
                    <div className="mt-3 space-y-1.5 p-2 bg-amber-50/20 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                      {mod.notes.map((n) => (
                        <div
                          key={`note-${n.value}`}
                          className="text-xs text-gray-100 dark:text-gray-100 leading-relaxed flex gap-2 items-start"
                        >
                          <span className="text-amber-500 shrink-0 mt-0.5">
                            📌
                          </span>
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
                    className={`mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-700 ${isCompact ? "hidden" : ""}`}
                  >
                    {mod.projectType && mod.projectType !== "mod" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                        {mod.projectType}
                      </span>
                    )}
                    {mod.links
                      .filter((l) => l.url.trim() !== "")
                      .map((link, linkIdx) => {
                        const url = link.url;
                        let displayLabel = link.label.trim();
                        if (displayLabel.startsWith("http")) {
                          if (displayLabel.includes("modrinth"))
                            displayLabel = "MODRINTH URL";
                          else if (displayLabel.includes("curseforge"))
                            displayLabel = "CURSEFORGE URL";
                          else displayLabel = "URL";
                        }
                        displayLabel = displayLabel.toUpperCase();

                        return (
                          <a
                            key={`link-${url}-${displayLabel}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors cursor-pointer"
                          >
                            {url.includes("google.com/search") ? (
                              "🔍"
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-2.5 w-2.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-label="External link"
                              >
                                <title>External link icon</title>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            )}
                            <span>
                              {linkIdx > 0
                                ? `ALTERNATIVE: ${displayLabel}`
                                : displayLabel}
                            </span>
                          </a>
                        );
                      })}
                    {mod.links.filter((l) => l.url.trim() !== "").length ===
                      0 && (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(mod.name + " minecraft mod")}`}
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
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            No mods found matching your search and filters.
          </p>
          {(search || categoryFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
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
