import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The plugin folder is what the installer copies, so it stands in for <plugin_root>.
const pluginRoot = join(import.meta.dir, "..");

// Pull the statusLine command out of the JSON block the setup command tells the model to write.
function setupStatusLineCommand(): string {
  const setup = readFileSync(join(pluginRoot, "commands", "setup.md"), "utf8");
  const match = setup.match(/"statusLine":\s*\{[^}]*"command":\s*"([^"]+)"/);
  if (!match?.[1]) throw new Error("setup.md has no statusLine command");
  return match[1].replaceAll("<plugin_root>", pluginRoot);
}

test("the statusline command setup writes renders the model name from the installed plugin folder", () => {
  const input = JSON.stringify({
    model: { display_name: "Test Model" },
    output_style: { name: "default" },
    workspace: { current_dir: pluginRoot, project_dir: pluginRoot },
  });

  const result = Bun.spawnSync(["sh", "-c", setupStatusLineCommand()], {
    stdin: Buffer.from(input),
  });

  expect(result.stdout.toString()).toContain("Test Model");
});
