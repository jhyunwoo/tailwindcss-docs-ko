import manifestJson from "../../data/docs-manifest.json";
import { sourceModules, translatedModules } from "@/content/generated";

export type DocManifestEntry = {
  route: string;
  title: string;
  description?: string;
  section: string;
  navTitle: string;
  outputPath: string;
  sourcePath: string;
  sourceKind: "mdx" | "tsx";
  sourceUrl: string;
  sourceCommit: string;
  contentHash: string;
  status: "source" | "translated";
  tabGroup?: string;
  tabLabel?: string;
  redirectTo?: string;
};

export type NavigationSection = {
  title: string;
  items: Array<{
    route: string;
    navTitle: string;
  }>;
};

type ContentModule = {
  default: React.ComponentType;
  title?: string;
  description?: string;
};

const manifest = manifestJson as DocManifestEntry[];

export function joinRouteSlug(parts: string[]) {
  return `/docs/${parts.join("/")}`;
}

export function getDocRoutes() {
  return manifest.filter((entry) => !entry.redirectTo).map((entry) => entry.route);
}

export function getManifest() {
  return manifest;
}

export function getNavigationSections(): NavigationSection[] {
  const grouped = new Map<string, NavigationSection["items"]>();
  for (const entry of manifest) {
    if (entry.redirectTo) continue;
    if (!grouped.has(entry.section)) {
      grouped.set(entry.section, []);
    }
    grouped.get(entry.section)!.push({
      route: entry.route,
      navTitle: entry.navTitle,
    });
  }

  return [...grouped.entries()].map(([title, items]) => ({
    title,
    items,
  }));
}

export function getTabSiblings(entry: DocManifestEntry) {
  if (!entry.tabGroup) {
    return [];
  }

  return manifest.filter((candidate) => candidate.tabGroup === entry.tabGroup && !candidate.redirectTo);
}

export async function getDocPage(route: string): Promise<{ entry: DocManifestEntry; module: ContentModule } | null> {
  const entry = manifest.find((candidate) => candidate.route === route && !candidate.redirectTo);
  if (!entry) {
    return null;
  }

  const loader = translatedModules[entry.route] ?? sourceModules[entry.route];
  if (!loader) {
    return null;
  }

  const mod = (await loader()) as ContentModule;
  return { entry, module: mod };
}
