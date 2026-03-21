import OpenAI from "openai";
import { loadManifest, routeToSourceFile, routeToTranslatedFile, writeGeneratedRegistry, writeManifest } from "./lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is required to translate the docs corpus.");
  process.exit(1);
}

const model = process.env.OPENAI_MODEL || "gpt-5.2";
const limit = Number(process.env.TRANSLATE_LIMIT || "0");
const filter = process.env.ROUTE_FILTER;
const batchSize = Math.max(1, Number(process.env.TRANSLATE_BATCH_SIZE || "1"));
const delayMs = Math.max(0, Number(process.env.TRANSLATE_DELAY_MS || "0"));
const client = new OpenAI({ apiKey });

function protectBlocks(source: string) {
  const protectedBlocks: string[] = [];
  const protect = (text: string, pattern: RegExp) =>
    text.replace(pattern, (match) => {
      const token = `__CODEX_BLOCK_${protectedBlocks.length}__`;
      protectedBlocks.push(match);
      return token;
    });

  let output = source;
  output = protect(output, /```[\s\S]*?```/g);
  output = protect(output, /^import .+$/gm);
  output = protect(output, /^export const (title|description) = .+$/gm);
  output = protect(output, /`[^`\n]+`/g);

  return { output, protectedBlocks };
}

function restoreBlocks(source: string, blocks: string[]) {
  return blocks.reduce((text, block, index) => text.replaceAll(`__CODEX_BLOCK_${index}__`, block), source);
}

async function translateDocument(source: string) {
  const { output, protectedBlocks } = protectBlocks(source);
  const response = await client.responses.create({
    model,
    instructions: [
      "You translate Tailwind CSS documentation from English to Korean.",
      "Return only valid MDX.",
      "Translate all human-visible prose to Korean.",
      "Do not translate code blocks, inline code placeholders, class names, package names, import paths, file paths, route paths, or placeholder tokens.",
      "Do not change `/docs/...` URLs, HTML id attributes, or custom component names.",
      "Keep the document structure intact.",
    ].join(" "),
    input: output,
  });

  return restoreBlocks(response.output_text.trim(), protectedBlocks);
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const manifest = await loadManifest();
const targets = manifest.filter((entry) => !entry.redirectTo).filter((entry) => !filter || entry.route.includes(filter));
const selected = limit > 0 ? targets.slice(0, limit) : targets;

console.log(
  `Translating ${selected.length} route(s) with model ${model}, batch size ${batchSize}, delay ${delayMs}ms`,
);

for (const [batchIndex, batch] of chunk(selected, batchSize).entries()) {
  await Promise.all(
    batch.map(async (entry) => {
      const source = await readFile(routeToSourceFile(entry.route), "utf8");
      const translated = await translateDocument(source);
      const target = routeToTranslatedFile(entry.route);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `${translated.trim()}\n`, "utf8");
      entry.status = "translated";
      console.log(`Translated ${entry.route}`);
    }),
  );

  if (delayMs > 0 && batchIndex < Math.ceil(selected.length / batchSize) - 1) {
    await sleep(delayMs);
  }
}

await writeManifest(manifest);
await writeGeneratedRegistry(manifest);
