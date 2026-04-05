import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

// ANSI helpers
const reset = "\x1b[0m";
const white = "\x1b[97m";
const dimmed = "\x1b[2;37m";
const cyan = "\x1b[36m";
const yellow = "\x1b[93m";
const blue = "\x1b[34m";
const red = "\x1b[91m";
const green = "\x1b[32m";
const magenta = "\x1b[35m";
const bgGreen = "\x1b[42m";
const bgYellow = "\x1b[43m";
const bgRed = "\x1b[41m";
const bgDimmed = "\x1b[48;5;238m";

interface StatusLineInput {
  model: { display_name?: string };
  output_style: { name?: string };
  workspace: {
    current_dir?: string;
    project_dir?: string;
  };
  context_window?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    used_percentage?: number;
  };
  cwd?: string;
  transcript_path?: string;
}

function run(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function commandExists(cmd: string): boolean {
  try {
    const which = process.platform === "win32" ? "where" : "command -v";
    execSync(`${which} ${cmd}`, { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

function getDirectoryDisplay(
  currentDir: string,
  projectDir: string,
): { emoji: string; name: string } {
  if (
    currentDir.startsWith(projectDir) &&
    currentDir !== projectDir
  ) {
    return { emoji: "\u{1F4C2}", name: currentDir.slice(projectDir.length + 1) };
  }
  return { emoji: "\u{1F4C1}", name: basename(currentDir) };
}

function getJjInfo(): string | null {
  if (!commandExists("jj")) return null;
  if (run("jj root") === null) return null;

  const changeId = run("jj log -r @ --no-graph -T 'change_id.short()'")?.slice(0, 8) ?? "";
  const parentChangeId = run("jj log -r '@-' --no-graph -T 'change_id.short()'")?.slice(0, 8) ?? "";

  const jjStatus = run("jj status") ?? "";
  const fileCount = (jjStatus.match(/^[MADR] /gm) ?? []).length;

  let currentDesc = run("jj log -r @ --no-graph -T 'description.first_line()'") ?? "";
  if (currentDesc.length > 80) currentDesc = currentDesc.slice(0, 77) + "...";

  let parentDesc = run("jj log -r '@-' --no-graph -T 'description.first_line()'") ?? "";
  if (parentDesc.length > 80) parentDesc = parentDesc.slice(0, 77) + "...";

  // Current description display
  let currentDescDisplay: string;
  if (!currentDesc) {
    currentDescDisplay =
      fileCount > 0
        ? `${red}(no description set)${reset}`
        : `${dimmed}(no description set)${reset}`;
  } else {
    currentDescDisplay = currentDesc;
  }

  // Parent description display
  const parentDescDisplay = !parentDesc
    ? `${red}(no description set)${reset}`
    : parentDesc;

  // File count display
  let fileCountDisplay: string;
  if (fileCount > 0) {
    const label = fileCount === 1 ? "1 file changed" : `${fileCount} files changed`;
    fileCountDisplay = ` ${blue}(${label})${reset}`;
  } else {
    fileCountDisplay = ` ${cyan}(empty)${reset}`;
  }

  return [
    `\n  ${cyan}Working copy  ${cyan}(@)${reset} : ${yellow}${changeId}${reset}${fileCountDisplay} ${currentDescDisplay}`,
    `\n  ${cyan}Parent commit ${cyan}(@-)${reset}: ${yellow}${parentChangeId}${reset} ${parentDescDisplay}`,
  ].join("");
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function getTokenDisplay(contextWindow?: StatusLineInput["context_window"]): string {
  if (!contextWindow) return "";

  const input = contextWindow.total_input_tokens ?? 0;
  const output = contextWindow.total_output_tokens ?? 0;
  const total = input + output;
  const pct = contextWindow.used_percentage ?? 0;

  if (total === 0 && pct === 0) return "";

  // Progress bar: 10 chars wide, color-coded by usage
  const barWidth = 10;
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;

  let barColor: string;
  let pctColor: string;
  if (pct < 50) {
    barColor = bgGreen;
    pctColor = green;
  } else if (pct < 80) {
    barColor = bgYellow;
    pctColor = yellow;
  } else {
    barColor = bgRed;
    pctColor = red;
  }

  const bar = `${barColor}${" ".repeat(filled)}${reset}${bgDimmed}${" ".repeat(empty)}${reset}`;

  return ` ${dimmed}${formatTokenCount(total)}${reset} ${bar} ${pctColor}${pct}%${reset}`;
}

function getLangInfo(currentDir: string): string {
  const parts: string[] = [];

  if (existsSync(join(currentDir, "package.json"))) {
    if (commandExists("bun")) {
      const v = run("bun --version");
      if (v) parts.push(`(bun:${v})`);
    } else if (commandExists("node")) {
      const v = run("node --version")?.replace(/^v/, "");
      if (v) parts.push(`node:${v}`);
    }
  }

  if (
    existsSync(join(currentDir, "pyproject.toml")) ||
    existsSync(join(currentDir, "setup.py")) ||
    existsSync(join(currentDir, "requirements.txt"))
  ) {
    if (commandExists("python3")) {
      const v = run("python3 --version")?.split(" ")[1];
      if (v) parts.push(`py:${v}`);
    }
  }

  if (existsSync(join(currentDir, "go.mod"))) {
    if (commandExists("go")) {
      const v = run("go version")?.match(/go(\S+)/)?.[1];
      if (v) parts.push(`go:${v}`);
    }
  }

  if (existsSync(join(currentDir, "Cargo.toml"))) {
    if (commandExists("rustc")) {
      const v = run("rustc --version")?.split(" ")[1];
      if (v) parts.push(`rust:${v}`);
    }
  }

  return parts.join(" ");
}

function main() {
  const chunks: Uint8Array[] = [];

  process.stdin.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const rawInput = Buffer.concat(chunks).toString();

    let input: StatusLineInput;
    try {
      input = JSON.parse(rawInput);
    } catch {
      process.stdout.write("nerdo-claude (parse error)");
      return;
    }

    const modelName = input.model?.display_name ?? "Unknown";
    const outputStyle = input.output_style?.name ?? "default";
    const currentDir = input.workspace?.current_dir ?? input.cwd ?? process.cwd();
    const projectDir =
      input.workspace?.project_dir ?? input.workspace?.current_dir ?? input.cwd ?? process.cwd();

    const dir = getDirectoryDisplay(currentDir, projectDir);
    const langInfo = getLangInfo(currentDir);
    const tokenDisplay = getTokenDisplay(input.context_window);
    const jjInfo = getJjInfo();

    // Build first line
    let line = `${reset}${dir.emoji} ${white}${dir.name}${reset}`;

    if (langInfo) {
      line += `${dimmed} ${langInfo}${reset}`;
    }

    line += "  \u{1F916} ";

    if (outputStyle !== "default") {
      line += `${white}${outputStyle}${reset} ${dimmed}(${modelName})${reset}`;
    } else {
      line += `${dimmed}(${modelName})${reset}`;
    }

    if (tokenDisplay) {
      line += tokenDisplay;
    }

    if (jjInfo) {
      line += jjInfo;
    }

    process.stdout.write(line);
  });
}

main();
