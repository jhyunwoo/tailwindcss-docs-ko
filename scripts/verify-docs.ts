import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  collectInternalDocLinks,
  collectHeadingIds,
  countAssetReferences,
  countCodeBlocks,
  countComponentUsages,
  countDocsLinks,
  countHeadings,
  countImportStatements,
  loadManifest,
  routeToSourceFile,
  routeToTranslatedFile,
  suspiciousEnglishRatio,
} from "./lib";

const execFileAsync = promisify(execFile);
const allowSourceFallback = process.env.VERIFY_ALLOW_SOURCE_FALLBACK === "1";
const runBuild = process.env.VERIFY_BUILD === "1";

function routeExists(route: string, knownRoutes: Set<string>, redirects: Set<string>) {
  return knownRoutes.has(route) || redirects.has(route);
}

const manifest = await loadManifest();
const contentEntries = manifest.filter((entry) => !entry.redirectTo);
const redirectEntries = manifest.filter((entry) => entry.redirectTo);
const knownRoutes = new Set(contentEntries.map((entry) => entry.route));
const knownRedirects = new Set(redirectEntries.map((entry) => entry.route));
const renderedDocs = new Map<string, string>();
const headingIdsByRoute = new Map<string, Set<string>>();
const translatedExistsByRoute = new Map<string, boolean>();
const failures: string[] = [];

for (const entry of contentEntries) {
  const translatedFile = routeToTranslatedFile(entry.route);
  const translatedExists = await import("node:fs/promises").then(({ stat }) => stat(translatedFile).then(() => true).catch(() => false));
  if (!translatedExists && !allowSourceFallback) {
    failures.push(`${entry.route}: missing translated output`);
    continue;
  }

  const rendered = await readFile(translatedExists ? translatedFile : routeToSourceFile(entry.route), "utf8");
  translatedExistsByRoute.set(entry.route, translatedExists);
  renderedDocs.set(entry.route, rendered);
  headingIdsByRoute.set(entry.route, new Set(collectHeadingIds(rendered)));
}

for (const entry of contentEntries) {
  const source = await readFile(routeToSourceFile(entry.route), "utf8");
  const rendered = renderedDocs.get(entry.route);
  if (!rendered) {
    continue;
  }
  if (countHeadings(source) !== countHeadings(rendered)) {
    failures.push(`${entry.route}: heading count mismatch`);
  }
  if (countCodeBlocks(source) !== countCodeBlocks(rendered)) {
    failures.push(`${entry.route}: code block count mismatch`);
  }
  if (countDocsLinks(source) !== countDocsLinks(rendered)) {
    failures.push(`${entry.route}: docs link count mismatch`);
  }
  if (countAssetReferences(source) !== countAssetReferences(rendered)) {
    failures.push(`${entry.route}: asset reference count mismatch`);
  }
  if (countImportStatements(source) !== countImportStatements(rendered)) {
    failures.push(`${entry.route}: import statement count mismatch`);
  }
  if (countComponentUsages(source) !== countComponentUsages(rendered)) {
    failures.push(`${entry.route}: component usage count mismatch`);
  }

  for (const destination of collectInternalDocLinks(rendered)) {
    const [pathname, hash] = destination.startsWith("#") ? [entry.route, destination.slice(1)] : destination.split("#");
    if (pathname.startsWith("/docs/") && !routeExists(pathname, knownRoutes, knownRedirects)) {
      failures.push(`${entry.route}: unresolved internal link ${destination}`);
    }
    if (hash && !destination.startsWith("#")) {
      const ids = headingIdsByRoute.get(pathname);
      if (ids && !ids.has(hash)) {
        failures.push(`${entry.route}: unresolved fragment ${destination}`);
      }
    }
  }

  if (translatedExistsByRoute.get(entry.route)) {
    const ratio = suspiciousEnglishRatio(rendered);
    if (ratio > 0.45) {
      failures.push(`${entry.route}: suspicious English residue ratio ${ratio.toFixed(2)}`);
    }
  }
}

for (const entry of redirectEntries) {
  if (!entry.redirectTo) continue;
  if (!knownRoutes.has(entry.redirectTo)) {
    failures.push(`${entry.route}: redirect target missing (${entry.redirectTo})`);
  }
}

if (runBuild) {
  await execFileAsync("pnpm", ["build"], { cwd: process.cwd() });
}

if (failures.length > 0) {
  console.error("Verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Verified ${contentEntries.length} content routes and ${redirectEntries.length} redirects.`);
