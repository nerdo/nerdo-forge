/**
 * Bumps the version in package.json using semver, then syncs to plugin manifests.
 * Usage: bun run bump:patch | bump:minor | bump:major
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const level = process.argv[2] as "patch" | "minor" | "major";
if (!["patch", "minor", "major"].includes(level)) {
  console.error("Usage: bun run scripts/bump-version.ts <patch|minor|major>");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const [major, minor, patch] = pkg.version.split(".").map(Number);
let newVersion: string;
switch (level) {
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case "patch":
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Bumped version: ${[major, minor, patch].join(".")} -> ${newVersion}`);

// Sync to plugin manifests
execSync("bun run version:sync", { cwd: root, stdio: "inherit" });
