/**
 * Syncs the version from package.json into plugin.json and marketplace.json.
 * Run via: bun run version:sync
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version: string = pkg.version;

// Update plugin.json
const pluginPath = join(root, ".claude-plugin", "plugin.json");
const plugin = JSON.parse(readFileSync(pluginPath, "utf-8"));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

// Update marketplace.json
const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf-8"));
for (const p of marketplace.plugins) {
  if (p.name === pkg.name) {
    p.version = version;
  }
}
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");

console.log(`Synced version ${version} to plugin.json and marketplace.json`);
