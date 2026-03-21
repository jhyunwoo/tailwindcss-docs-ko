import { syncAllContent } from "./lib";

const result = await syncAllContent();
const contentCount = result.entries.filter((entry) => !entry.redirectTo).length;
const redirectCount = result.entries.filter((entry) => entry.redirectTo).length;

console.log(`Synced Tailwind docs from commit ${result.commit}`);
console.log(`Content routes: ${contentCount}`);
console.log(`Redirect aliases: ${redirectCount}`);
