import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import dedent from "dedent";
import ts from "typescript";

const execFileAsync = promisify(execFile);

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

export type NormalizedInstallDoc = {
  route: string;
  title: string;
  description: string;
  section: string;
  navTitle: string;
  tabGroup?: string;
  tabLabel?: string;
  introHtml: string[];
  noticeHtml?: string;
  steps?: Array<{
    title: string;
    bodyHtml: string;
    code: { name: string; lang: string; code: string };
  }>;
  cta?: { label?: string; href?: string; bodyHtml: string };
  guideGrid?: Array<{ route: string; title: string; description: string }>;
  sourcePath: string;
  sourceKind: "tsx";
};

export const ROOT = process.cwd();
export const CACHE_DIR = path.join(ROOT, ".cache");
export const UPSTREAM_DIR = path.join(CACHE_DIR, "upstream", "tailwindcss.com");
export const SOURCE_CONTENT_DIR = path.join(ROOT, "src", "content", "source");
export const TRANSLATED_CONTENT_DIR = path.join(ROOT, "src", "content", "docs");
export const GENERATED_CONTENT_FILE = path.join(ROOT, "src", "content", "generated.ts");
export const MANIFEST_FILE = path.join(ROOT, "data", "docs-manifest.json");
export const PUBLIC_IMG_DIR = path.join(ROOT, "public", "img");

const RUNTIME_FILES = [
  "src/app/globals.css",
  "src/app/search.css",
  "src/app/typography.css",
  "src/app/fonts",
  "src/components/api-table.tsx",
  "src/components/content.tsx",
  "src/components/example.tsx",
  "src/components/figure.tsx",
  "src/components/stripes.tsx",
  "src/components/tips.tsx",
  "src/components/code-example.tsx",
  "src/components/copy-button.tsx",
  "src/components/highlight.tsx",
  "src/components/segment.ts",
  "src/components/shiki.ts",
  "src/components/iframe.tsx",
  "src/components/theme-toggle.tsx",
  "src/components/dynamic-viewport-example.tsx",
  "src/components/multi-cursor",
  "src/components/color-palette.tsx",
  "src/components/color.tsx",
  "src/components/tooltip.tsx",
  "src/components/syntax-highlighter",
  "src/docs/utils/colors.ts",
  "src/docs/img",
];

const INSTALL_PAGE_SPECS = [
  {
    route: "/docs/installation/using-vite",
    sourcePath: "src/app/(docs)/docs/installation/(tabs)/using-vite/page.tsx",
    navTitle: "Installation",
    tabGroup: "installation",
    tabLabel: "Using Vite",
  },
  {
    route: "/docs/installation/using-postcss",
    sourcePath: "src/app/(docs)/docs/installation/(tabs)/using-postcss/page.tsx",
    navTitle: "Using PostCSS",
    tabGroup: "installation",
    tabLabel: "Using PostCSS",
  },
  {
    route: "/docs/installation/tailwind-cli",
    sourcePath: "src/app/(docs)/docs/installation/(tabs)/tailwind-cli/page.tsx",
    navTitle: "Tailwind CLI",
    tabGroup: "installation",
    tabLabel: "Tailwind CLI",
  },
  {
    route: "/docs/installation/play-cdn",
    sourcePath: "src/app/(docs)/docs/installation/(tabs)/play-cdn/page.tsx",
    navTitle: "Play CDN",
    tabGroup: "installation",
    tabLabel: "Play CDN",
  },
  {
    route: "/docs/installation/framework-guides",
    sourcePath: "src/app/(docs)/docs/installation/(tabs)/framework-guides/page.tsx",
    navTitle: "Framework guides",
    tabGroup: "installation",
    tabLabel: "Framework Guides",
  },
] as const;

const GUIDE_ROUTE_SLUGS: Record<string, string> = {
  "nextjs.tsx": "nextjs",
  "nuxtjs.tsx": "nuxt",
  "solidjs.tsx": "solidjs",
  "sveltekit.tsx": "sveltekit",
  "gatsby.tsx": "gatsby",
  "angular.tsx": "angular",
  "ruby-on-rails.tsx": "ruby-on-rails",
  "react-router.tsx": "react-router",
  "tanstack-start.tsx": "tanstack-start",
  "phoenix.tsx": "phoenix",
  "parcel.tsx": "parcel",
  "symfony.tsx": "symfony",
  "meteor.tsx": "meteor",
  "adonisjs.tsx": "adonisjs",
  "emberjs.tsx": "emberjs",
  "astro.tsx": "astro",
  "qwik.tsx": "qwik",
  "laravel.tsx": "laravel",
  "rspack.tsx": "rspack",
};

type GuideSummary = {
  route: string;
  title: string;
  description: string;
};

type EvalGuideModule = {
  page: {
    title: string;
    description: string;
    intro?: React.ReactNode;
    notice?: React.ReactNode;
  };
  tile: {
    title: string;
    description: string;
  };
  tabs?: Array<{ slug: string; title: string }>;
  steps: Array<{
    tabs?: string[];
    title: string;
    body: React.ReactNode;
    code?: { name: string; lang: string; code: string };
  }>;
};

const DocCta = ({ label, href, children }: { label?: string; href?: string; children: React.ReactNode }) =>
  React.createElement("codex-cta", { label, href }, children);

const DocSteps = (props: { steps: unknown[] }) => React.createElement("codex-steps", props);
const DocTabBar = (props: { tabs: unknown[] }) => React.createElement("codex-tabbar", props);
const LinkStub = ({ href, children }: { href: string; children: React.ReactNode }) =>
  React.createElement("a", { href }, children);

type ReactNodeLike = React.ReactNode | React.ReactElement | null | undefined;
type AnyElement = React.ReactElement<any, any>;

export function rel(filePath: string) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

export function routeToOutputPath(route: string) {
  const normalized = route.replace(/^\/docs\//, "");
  return `${normalized}.mdx`;
}

export function routeToSourceFile(route: string) {
  return path.join(SOURCE_CONTENT_DIR, routeToOutputPath(route));
}

export function routeToTranslatedFile(route: string) {
  return path.join(TRANSLATED_CONTENT_DIR, routeToOutputPath(route));
}

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export async function cleanDir(dirPath: string) {
  await rm(dirPath, { recursive: true, force: true });
  await mkdir(dirPath, { recursive: true });
}

export async function writeText(filePath: string, text: string) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, text, "utf8");
}

export function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function ensureUpstreamRepo() {
  await ensureDir(path.dirname(UPSTREAM_DIR));
  if (!existsSync(UPSTREAM_DIR)) {
    await execFileAsync("git", ["clone", "--depth", "1", "https://github.com/tailwindlabs/tailwindcss.com", UPSTREAM_DIR], {
      cwd: ROOT,
    });
  } else {
    await execFileAsync("git", ["fetch", "origin", "main", "--depth", "1"], { cwd: UPSTREAM_DIR });
    await execFileAsync("git", ["reset", "--hard", "FETCH_HEAD"], { cwd: UPSTREAM_DIR });
    await execFileAsync("git", ["clean", "-fd"], { cwd: UPSTREAM_DIR });
  }
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: UPSTREAM_DIR });
  return stdout.trim();
}

export async function vendorRuntimeFiles() {
  for (const relativePath of RUNTIME_FILES) {
    const from = path.join(UPSTREAM_DIR, relativePath);
    const to = path.join(ROOT, relativePath);
    const sourceStat = await stat(from);
    await ensureDir(path.dirname(to));
    if (sourceStat.isDirectory()) {
      await rm(to, { recursive: true, force: true });
      await cp(from, to, { recursive: true });
    } else {
      await cp(from, to);
    }
  }
}

function safeEvalIndex(source: string) {
  const executable = source.replace("export default", "return").replaceAll(" as const", "");
  return new Function(executable)() as Record<string, Array<[string, string, Array<[string, string]>?]>>;
}

export async function loadDocsNavigation() {
  const source = await readFile(path.join(UPSTREAM_DIR, "src/app/(docs)/docs/index.tsx"), "utf8");
  const index = safeEvalIndex(source);
  const map = new Map<string, { section: string; navTitle: string }>();

  for (const [section, entries] of Object.entries(index)) {
    for (const [title, route, children] of entries) {
      map.set(route, { section, navTitle: title });
      if (children) {
        for (const [childTitle, childRoute] of children) {
          map.set(childRoute, { section, navTitle: childTitle });
        }
      }
    }
  }

  return map;
}

function normalizeRelativeImageImports(text: string) {
  return text
    .replaceAll('from "./img/', 'from "@/docs/img/')
    .replaceAll('require("./img/', 'require("@/docs/img/')
    .replaceAll('from "./utils/colors"', 'from "@/docs/utils/colors"')
    .replaceAll('from "../components/', 'from "@/components/');
}

function extractMdxExport(text: string, name: string) {
  const match = text.match(new RegExp(`export const ${name} = "([\\s\\S]*?)";`));
  return match?.[1] ?? "";
}

export async function syncRegularDocs(
  commit: string,
  navigation: Map<string, { section: string; navTitle: string }>,
) {
  const docsDir = path.join(UPSTREAM_DIR, "src/docs");
  const files = (await readdir(docsDir)).filter((file) => file.endsWith(".mdx")).sort();
  const entries: DocManifestEntry[] = [];

  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "");
    const route = `/docs/${slug}`;
    const sourcePath = path.join("src/docs", file);
    const sourceFile = path.join(docsDir, file);
    const raw = await readFile(sourceFile, "utf8");
    const rewritten = normalizeRelativeImageImports(raw);
    const outputPath = routeToOutputPath(route);
    const outputFile = path.join(SOURCE_CONTENT_DIR, outputPath);
    await writeText(outputFile, rewritten);

    const navigationEntry = navigation.get(route) ?? { section: "Docs", navTitle: slug };
    const translatedFile = routeToTranslatedFile(route);

    entries.push({
      route,
      title: extractMdxExport(rewritten, "title"),
      description: extractMdxExport(rewritten, "description"),
      section: navigationEntry.section,
      navTitle: navigationEntry.navTitle,
      outputPath,
      sourcePath,
      sourceKind: "mdx",
      sourceUrl: `https://tailwindcss.com${route}`,
      sourceCommit: commit,
      contentHash: sha256(rewritten),
      status: (await fileExists(translatedFile)) ? "translated" : "source",
    });
  }

  return entries;
}

function createTemplateTag(lang: string) {
  return (strings: TemplateStringsArray, ...args: unknown[]) => dedent(strings, ...(args as never[]));
}

function createRequireShim(filePath: string, extra: Record<string, unknown>) {
  const tagModules = {
    js: createTemplateTag("js"),
    ts: createTemplateTag("ts"),
    jsx: createTemplateTag("jsx"),
    html: createTemplateTag("html"),
    shell: createTemplateTag("shell"),
    css: createTemplateTag("css"),
    json: createTemplateTag("json"),
    edge: createTemplateTag("edge"),
    twig: createTemplateTag("twig"),
    astro: createTemplateTag("astro"),
    vue: createTemplateTag("vue"),
    svelte: createTemplateTag("svelte"),
    handlebars: createTemplateTag("handlebars"),
    blade: createTemplateTag("blade"),
    hbs: createTemplateTag("hbs"),
    elixir: createTemplateTag("elixir"),
    tsx: createTemplateTag("tsx"),
  };

  const defaultMap: Record<string, unknown> = {
    dedent: { __esModule: true, default: dedent },
    react: { __esModule: true, default: React },
    "next/link": { __esModule: true, default: LinkStub },
    "@/components/cta": { Cta: DocCta },
    "@/components/installation-steps": { Steps: DocSteps },
    "@/components/installation-tabs": { TabBar: DocTabBar },
    "./utils": tagModules,
  };

  return (specifier: string) => {
    if (specifier in extra) {
      return extra[specifier];
    }

    if (specifier in defaultMap) {
      return defaultMap[specifier];
    }

    if (specifier.endsWith(".react.svg") || specifier.endsWith(".svg") || specifier.endsWith(".png") || specifier.endsWith(".jpg")) {
      return { __esModule: true, default: () => null };
    }

    if (specifier.startsWith("@/docs/img/")) {
      return { __esModule: true, default: specifier.replace("@/docs/img", "/img") };
    }

    if (specifier.startsWith(".")) {
      const resolved = path.join(path.dirname(filePath), specifier);
      if (resolved in extra) {
        return extra[resolved];
      }
    }

    throw new Error(`Unsupported import in evaluator: ${specifier}`);
  };
}

function transpileModuleSource(source: string, filePath: string, extraRequires: Record<string, unknown> = {}) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "React.createElement",
      jsxFragmentFactory: "React.Fragment",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: filePath,
  });

  const compiledModule = { exports: {} as Record<string, unknown> };
  const evaluator = new Function(
    "require",
    "module",
    "exports",
    "React",
    "__dirname",
    "__filename",
    result.outputText,
  );
  evaluator(
    createRequireShim(filePath, extraRequires),
    compiledModule,
    compiledModule.exports,
    React,
    path.dirname(filePath),
    filePath,
  );
  return compiledModule.exports;
}

function renderNode(node: ReactNodeLike) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  return renderToStaticMarkup(React.createElement(React.Fragment, null, node));
}

function walkTree(node: ReactNodeLike, visitor: (element: AnyElement) => void) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) {
      walkTree(child as ReactNodeLike, visitor);
    }
    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  const element = node as AnyElement;
  visitor(element);
  for (const child of React.Children.toArray(element.props.children)) {
    walkTree(child as ReactNodeLike, visitor);
  }
}

function findElement(
  node: ReactNodeLike,
  predicate: (element: AnyElement) => boolean,
): AnyElement | null {
  let match: AnyElement | null = null;
  walkTree(node, (element) => {
    if (!match && predicate(element)) {
      match = element;
    }
  });
  return match;
}

function renderParagraphChildren(parent: AnyElement) {
  return React.Children.toArray(parent.props.children)
    .filter((child) => React.isValidElement(child) && child.type === "p")
    .map((child) => renderNode(child as React.ReactElement))
    .filter(Boolean);
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function makeHeading(level: number, id: string, text: string) {
  return `<h${level} id="${id}">${text}</h${level}>`;
}

function makeCodeFence(block: { name: string; lang: string; code: string }) {
  const fenceInfo = block.lang ? block.lang : "txt";
  return `\`\`\`${fenceInfo}\n${block.code.trimEnd()}\n\`\`\``;
}

function serializeGuideGrid(guides: GuideSummary[]) {
  const encoded = JSON.stringify(guides, null, 2);
  return `import { GuideGrid } from "@/components/doc-blocks";\n\n<GuideGrid guides={${encoded}} />`;
}

function serializeCallout(callout: NonNullable<NormalizedInstallDoc["cta"]>) {
  return [
    'import { DocCallout } from "@/components/doc-blocks";',
    "",
    `<DocCallout${callout.label ? ` label=${JSON.stringify(callout.label)}` : ""}${
      callout.href ? ` href=${JSON.stringify(callout.href)}` : ""
    }>`,
    callout.bodyHtml,
    "</DocCallout>",
  ].join("\n");
}

export function serializeNormalizedDoc(doc: NormalizedInstallDoc) {
  const imports = new Set<string>();
  const parts: string[] = [
    `export const title = ${JSON.stringify(doc.title)};`,
    `export const description = ${JSON.stringify(doc.description)};`,
    "",
  ];

  for (const intro of doc.introHtml) {
    parts.push(intro, "");
  }

  if (doc.noticeHtml) {
    imports.add('import { DocCallout } from "@/components/doc-blocks";');
    parts.push(`<DocCallout>${doc.noticeHtml}</DocCallout>`, "");
  }

  if (doc.guideGrid?.length) {
    imports.add('import { GuideGrid } from "@/components/doc-blocks";');
    parts.push(`<GuideGrid guides={${JSON.stringify(doc.guideGrid, null, 2)}} />`, "");
  }

  if (doc.steps?.length) {
    for (const step of doc.steps) {
      parts.push(makeHeading(2, slugifyHeading(step.title), step.title), "", step.bodyHtml, "", makeCodeFence(step.code), "");
    }
  }

  if (doc.cta) {
    imports.add('import { DocCallout } from "@/components/doc-blocks";');
    parts.push(
      `<DocCallout${doc.cta.label ? ` label=${JSON.stringify(doc.cta.label)}` : ""}${
        doc.cta.href ? ` href=${JSON.stringify(doc.cta.href)}` : ""
      }>`,
      doc.cta.bodyHtml,
      "</DocCallout>",
      "",
    );
  }

  return `${[...imports].sort().join("\n")}${imports.size ? "\n\n" : ""}${parts.join("\n").trim()}\n`;
}

function sourceWithExportedSteps(source: string) {
  return source.replace(/const steps:\s*Step\[\]\s*=/, "export const steps =");
}

async function normalizeInstallationPage(
  commit: string,
  pageSpec: (typeof INSTALL_PAGE_SPECS)[number],
): Promise<NormalizedInstallDoc> {
  const absolute = path.join(UPSTREAM_DIR, pageSpec.sourcePath);
  const raw = await readFile(absolute, "utf8");
  const evaluated = transpileModuleSource(sourceWithExportedSteps(raw), absolute) as {
    metadata: { title: string; description: string };
    steps: Array<{ title: string; body: React.ReactNode; code: { name: string; lang: string; code: string } }>;
    default: () => React.ReactElement;
  };
  const tree = evaluated.default();
  const content = findElement(tree, (element) => element.props.id === "content-wrapper");
  const cta = findElement(tree, (element) => element.type === "codex-cta");

  return {
    route: pageSpec.route,
    title: evaluated.metadata.title,
    description: evaluated.metadata.description,
    section: "Installation",
    navTitle: pageSpec.navTitle,
    tabGroup: pageSpec.tabGroup,
    tabLabel: pageSpec.tabLabel,
    introHtml: content ? renderParagraphChildren(content) : [],
    steps: evaluated.steps.map((step) => ({
      title: step.title,
      bodyHtml: renderNode(step.body),
      code: step.code,
    })),
    cta: cta
      ? {
          label: cta.props.label,
          href: cta.props.href,
          bodyHtml: renderNode(cta.props.children),
        }
      : undefined,
    sourcePath: pageSpec.sourcePath,
    sourceKind: "tsx",
  };
}

async function normalizeGuideModules() {
  const guidesDir = path.join(UPSTREAM_DIR, "src/app/(docs)/docs/installation/framework-guides");
  const files = (await readdir(guidesDir))
    .filter((file) => file.endsWith(".tsx") && file !== "[...slug]/page.tsx" && file !== "index.ts" && file !== "utils.ts")
    .sort();

  const docs: NormalizedInstallDoc[] = [];
  const guideSummaries: GuideSummary[] = [];

  for (const file of files) {
    const absolute = path.join(guidesDir, file);
    const routeSlug = GUIDE_ROUTE_SLUGS[file];
    const evaluated = transpileModuleSource(await readFile(absolute, "utf8"), absolute) as EvalGuideModule;
    const pageIntro = renderNode(evaluated.page.intro);
    const notice = renderNode(evaluated.page.notice);
    const baseRoute = `/docs/installation/framework-guides/${routeSlug}`;

    if (evaluated.tabs?.length) {
      for (const tab of evaluated.tabs) {
        const route = `${baseRoute}/${tab.slug}`;
        const pageTitle = `${evaluated.tile.title} (${tab.title})`;
        const steps = evaluated.steps
          .filter((step) => !step.tabs || step.tabs.includes(tab.slug))
          .map((step) => ({
            title: step.title,
            bodyHtml: renderNode(step.body),
            code: step.code!,
          }));

        docs.push({
          route,
          title: evaluated.page.title,
          description: evaluated.page.description,
          section: "Installation",
          navTitle: pageTitle,
          tabGroup: `framework-guides/${routeSlug}`,
          tabLabel: tab.title,
          introHtml: pageIntro ? [pageIntro] : [],
          noticeHtml: notice || undefined,
          steps,
          sourcePath: rel(absolute),
          sourceKind: "tsx",
        });
      }
    } else {
      docs.push({
        route: baseRoute,
        title: evaluated.page.title,
        description: evaluated.page.description,
        section: "Installation",
        navTitle: evaluated.tile.title,
        introHtml: pageIntro ? [pageIntro] : [],
        noticeHtml: notice || undefined,
        steps: evaluated.steps.map((step) => ({
          title: step.title,
          bodyHtml: renderNode(step.body),
          code: step.code!,
        })),
        sourcePath: rel(absolute),
        sourceKind: "tsx",
      });
    }

    guideSummaries.push({
      route: evaluated.tabs?.length ? `${baseRoute}/${evaluated.tabs[0].slug}` : baseRoute,
      title: evaluated.tile.title,
      description: evaluated.tile.description,
    });
  }

  return { docs, guideSummaries };
}

async function normalizeFrameworkGuidesOverview(
  guideSummaries: GuideSummary[],
): Promise<NormalizedInstallDoc> {
  const sourcePath = "src/app/(docs)/docs/installation/(tabs)/framework-guides/page.tsx";
  const raw = await readFile(path.join(UPSTREAM_DIR, sourcePath), "utf8");
  const title = raw.match(/title:\s*"([^"]+)"/)?.[1] ?? "Framework guides";
  const description = raw.match(/description:\s*"([^"]+)"/)?.[1] ?? "";

  return {
    route: "/docs/installation/framework-guides",
    title,
    description,
    section: "Installation",
    navTitle: "Framework guides",
    tabGroup: "installation",
    tabLabel: "Framework Guides",
    introHtml: [`<p>${description}</p>`],
    guideGrid: guideSummaries,
    cta: {
      bodyHtml:
        `<p>Don't see your framework of choice? Try using the <a href="/docs/installation/tailwind-cli">Tailwind CLI</a>, the <a href="/docs/installation/using-vite">Vite plugin</a>, or the <a href="/docs/installation/using-postcss">PostCSS plugin</a> instead.</p>`,
    },
    sourcePath,
    sourceKind: "tsx",
  };
}

async function buildNormalizedInstallDocs(commit: string) {
  const installDocs = await Promise.all(INSTALL_PAGE_SPECS.filter((spec) => spec.route !== "/docs/installation/framework-guides").map((spec) => normalizeInstallationPage(commit, spec)));
  const { docs: guideDocs, guideSummaries } = await normalizeGuideModules();
  const frameworkOverview = await normalizeFrameworkGuidesOverview(guideSummaries);

  const allDocs = [...installDocs, frameworkOverview, ...guideDocs];
  const entries: DocManifestEntry[] = [];

  for (const doc of allDocs) {
    const mdx = serializeNormalizedDoc(doc);
    const outputPath = routeToOutputPath(doc.route);
    await writeText(path.join(SOURCE_CONTENT_DIR, outputPath), mdx);
    const translatedFile = routeToTranslatedFile(doc.route);

    entries.push({
      route: doc.route,
      title: doc.title,
      description: doc.description,
      section: doc.section,
      navTitle: doc.navTitle,
      outputPath,
      sourcePath: doc.sourcePath,
      sourceKind: doc.sourceKind,
      sourceUrl: `https://tailwindcss.com${doc.route}`,
      sourceCommit: commit,
      contentHash: sha256(mdx),
      status: (await fileExists(translatedFile)) ? "translated" : "source",
      tabGroup: doc.tabGroup,
      tabLabel: doc.tabLabel,
    });
  }

  entries.push(
    {
      route: "/docs",
      title: "Docs",
      section: "Redirects",
      navTitle: "Docs",
      outputPath: "",
      sourcePath: "",
      sourceKind: "tsx",
      sourceUrl: "https://tailwindcss.com/docs",
      sourceCommit: commit,
      contentHash: "",
      status: "source",
      redirectTo: "/docs/installation/using-vite",
    },
    {
      route: "/docs/installation",
      title: "Installation",
      section: "Redirects",
      navTitle: "Installation",
      outputPath: "",
      sourcePath: "",
      sourceKind: "tsx",
      sourceUrl: "https://tailwindcss.com/docs/installation",
      sourceCommit: commit,
      contentHash: "",
      status: "source",
      redirectTo: "/docs/installation/using-vite",
    },
    {
      route: "/docs/installation/framework-guides/laravel",
      title: "Laravel",
      section: "Redirects",
      navTitle: "Laravel",
      outputPath: "",
      sourcePath: "",
      sourceKind: "tsx",
      sourceUrl: "https://tailwindcss.com/docs/installation/framework-guides/laravel",
      sourceCommit: commit,
      contentHash: "",
      status: "source",
      redirectTo: "/docs/installation/framework-guides/laravel/vite",
    },
    {
      route: "/docs/installation/framework-guides/rspack",
      title: "Rspack",
      section: "Redirects",
      navTitle: "Rspack",
      outputPath: "",
      sourcePath: "",
      sourceKind: "tsx",
      sourceUrl: "https://tailwindcss.com/docs/installation/framework-guides/rspack",
      sourceCommit: commit,
      contentHash: "",
      status: "source",
      redirectTo: "/docs/installation/framework-guides/rspack/react",
    },
    {
      route: "/docs/text-color",
      title: "Text color",
      section: "Redirects",
      navTitle: "Text color",
      outputPath: "",
      sourcePath: "",
      sourceKind: "tsx",
      sourceUrl: "https://tailwindcss.com/docs/text-color",
      sourceCommit: commit,
      contentHash: "",
      status: "source",
      redirectTo: "/docs/color",
    },
  );

  return entries;
}

export async function fileExists(filePath: string) {
  return existsSync(filePath);
}

export async function backfillPublicImages(sourceEntries: DocManifestEntry[]) {
  const files = await collectFiles(SOURCE_CONTENT_DIR);
  const imagePaths = new Set<string>();

  for (const file of files.filter((candidate) => candidate.endsWith(".mdx"))) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/["'(]\/img\/([^"'()]+)["')]/g)) {
      imagePaths.add(match[1]);
    }
  }

  await ensureDir(PUBLIC_IMG_DIR);
  for (const relativePath of imagePaths) {
    const target = path.join(PUBLIC_IMG_DIR, relativePath);
    if (await fileExists(target)) continue;
    await ensureDir(path.dirname(target));
    const response = await fetch(`https://tailwindcss.com/img/${relativePath}`);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(target, buffer);
  }
}

async function collectFiles(dirPath: string): Promise<string[]> {
  if (!(await fileExists(dirPath))) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

export async function writeManifest(entries: DocManifestEntry[]) {
  const sorted = [...entries].sort((left, right) => left.route.localeCompare(right.route));
  await writeText(MANIFEST_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

export async function writeGeneratedRegistry(entries: DocManifestEntry[]) {
  const contentEntries = entries.filter((entry) => !entry.redirectTo);
  const translatedLoaders: string[] = [];
  const sourceLoaders: string[] = [];

  for (const entry of contentEntries) {
    sourceLoaders.push(`  ${JSON.stringify(entry.route)}: () => import(${JSON.stringify(`./source/${entry.outputPath}`)}),`);
    if (await fileExists(routeToTranslatedFile(entry.route))) {
      translatedLoaders.push(`  ${JSON.stringify(entry.route)}: () => import(${JSON.stringify(`./docs/${entry.outputPath}`)}),`);
    }
  }

  const source = `export const translatedModules: Record<string, () => Promise<any>> = {\n${translatedLoaders.join(
    "\n",
  )}\n};\n\nexport const sourceModules: Record<string, () => Promise<any>> = {\n${sourceLoaders.join("\n")}\n};\n`;
  await writeText(GENERATED_CONTENT_FILE, source);
}

export async function syncAllContent() {
  const commit = await ensureUpstreamRepo();
  await vendorRuntimeFiles();
  await cleanDir(SOURCE_CONTENT_DIR);
  await ensureDir(TRANSLATED_CONTENT_DIR);
  const navigation = await loadDocsNavigation();
  const regularEntries = await syncRegularDocs(commit, navigation);
  const installEntries = await buildNormalizedInstallDocs(commit);
  const allEntries = [...regularEntries, ...installEntries];
  await writeManifest(allEntries);
  await writeGeneratedRegistry(allEntries);
  await backfillPublicImages(allEntries);
  return {
    commit,
    entries: allEntries,
  };
}

export async function loadManifest() {
  const raw = await readFile(MANIFEST_FILE, "utf8");
  return JSON.parse(raw) as DocManifestEntry[];
}

export function stripCodeFences(text: string) {
  return text.replace(/```[\s\S]*?```/g, "");
}

export function stripInlineCode(text: string) {
  return text.replace(/`[^`]+`/g, "");
}

export function countHeadings(text: string) {
  return [...text.matchAll(/^(#{1,6})\s+.+$|<h[1-6]\s+id="[^"]+">[\s\S]*?<\/h[1-6]>/gm)].length;
}

export function countCodeBlocks(text: string) {
  return [...text.matchAll(/```/g)].length / 2;
}

export function countDocsLinks(text: string) {
  return collectInternalDocLinks(text).length;
}

export function countAssetReferences(text: string) {
  return [
    ...text.matchAll(/!\[[^\]]*\]\([^)]+\)/g),
    ...text.matchAll(/<img\b[^>]*>/g),
    ...text.matchAll(/(?:from|require\()["']@\/docs\/img\/[^"')]+/g),
    ...text.matchAll(/\/img\/[A-Za-z0-9/_\-.]+/g),
  ].length;
}

export function countComponentUsages(text: string) {
  return [...text.matchAll(/<([A-Z][A-Za-z0-9.]*)\b/g)].length;
}

export function countImportStatements(text: string) {
  return [...text.matchAll(/^import .+$/gm)].length;
}

export function collectInternalDocLinks(text: string) {
  const matches = new Set<string>();
  const patterns = [
    /\]\((\/docs\/[^)\s]+)\)/g,
    /<a[^>]+href="(\/docs\/[^"]+)"/g,
    /<a[^>]+href='(\/docs\/[^']+)'/g,
    /"route":\s*"(\/docs\/[^"]+)"/g,
    /\]\((#[^)]+)\)/g,
    /<a[^>]+href="(#[^"]+)"/g,
    /<a[^>]+href='(#[^']+)'/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      matches.add(match[1]);
    }
  }

  return [...matches];
}

export function collectHeadingIds(text: string) {
  const ids = new Set<string>();

  for (const match of text.matchAll(/<h[1-6]\s+id="([^"]+)">/g)) {
    ids.add(match[1]);
  }

  for (const match of text.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    const headingText = match[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (headingText) {
      ids.add(
        headingText
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-"),
      );
    }
  }

  return [...ids];
}

export function suspiciousEnglishRatio(text: string) {
  const stripped = stripInlineCode(stripCodeFences(text));
  const letters = (stripped.match(/[A-Za-z]/g) ?? []).length;
  const korean = (stripped.match(/[가-힣]/g) ?? []).length;
  if (letters === 0) return 0;
  return letters / Math.max(korean + letters, 1);
}
