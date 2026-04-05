// src/statusline.ts
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
var reset = "\x1B[0m";
var white = "\x1B[97m";
var dimmed = "\x1B[2;37m";
var cyan = "\x1B[36m";
var yellow = "\x1B[93m";
var blue = "\x1B[34m";
var red = "\x1B[91m";
var green = "\x1B[32m";
var bgGreen = "\x1B[42m";
var bgYellow = "\x1B[43m";
var bgRed = "\x1B[41m";
var bgDimmed = "\x1B[48;5;238m";
function run(cmd) {
  try {
    return execSync(cmd, { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch {
    return null;
  }
}
function commandExists(cmd) {
  try {
    const which = process.platform === "win32" ? "where" : "command -v";
    execSync(`${which} ${cmd}`, { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}
function getDirectoryDisplay(currentDir, projectDir) {
  if (currentDir.startsWith(projectDir) && currentDir !== projectDir) {
    return { emoji: "\uD83D\uDCC2", name: currentDir.slice(projectDir.length + 1) };
  }
  return { emoji: "\uD83D\uDCC1", name: basename(currentDir) };
}
function getJjInfo() {
  if (!commandExists("jj"))
    return null;
  if (run("jj root") === null)
    return null;
  const changeId = run("jj log -r @ --no-graph -T 'change_id.short()'")?.slice(0, 8) ?? "";
  const parentChangeId = run("jj log -r '@-' --no-graph -T 'change_id.short()'")?.slice(0, 8) ?? "";
  const jjStatus = run("jj status") ?? "";
  const fileCount = (jjStatus.match(/^[MADR] /gm) ?? []).length;
  let currentDesc = run("jj log -r @ --no-graph -T 'description.first_line()'") ?? "";
  if (currentDesc.length > 80)
    currentDesc = currentDesc.slice(0, 77) + "...";
  let parentDesc = run("jj log -r '@-' --no-graph -T 'description.first_line()'") ?? "";
  if (parentDesc.length > 80)
    parentDesc = parentDesc.slice(0, 77) + "...";
  let currentDescDisplay;
  if (!currentDesc) {
    currentDescDisplay = fileCount > 0 ? `${red}(no description set)${reset}` : `${dimmed}(no description set)${reset}`;
  } else {
    currentDescDisplay = currentDesc;
  }
  const parentDescDisplay = !parentDesc ? `${red}(no description set)${reset}` : parentDesc;
  let fileCountDisplay;
  if (fileCount > 0) {
    const label = fileCount === 1 ? "1 file changed" : `${fileCount} files changed`;
    fileCountDisplay = ` ${blue}(${label})${reset}`;
  } else {
    fileCountDisplay = ` ${cyan}(empty)${reset}`;
  }
  return [
    `
  ${cyan}Working copy  ${cyan}(@)${reset} : ${yellow}${changeId}${reset}${fileCountDisplay} ${currentDescDisplay}`,
    `
  ${cyan}Parent commit ${cyan}(@-)${reset}: ${yellow}${parentChangeId}${reset} ${parentDescDisplay}`
  ].join("");
}
function formatTokenCount(n) {
  if (n >= 1e6)
    return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function getTokenDisplay(contextWindow) {
  if (!contextWindow)
    return "";
  const input = contextWindow.total_input_tokens ?? 0;
  const output = contextWindow.total_output_tokens ?? 0;
  const total = input + output;
  const pct = contextWindow.used_percentage ?? 0;
  if (total === 0 && pct === 0)
    return "";
  const barWidth = 10;
  const filled = Math.round(pct / 100 * barWidth);
  const empty = barWidth - filled;
  let barColor;
  let pctColor;
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
function getLangInfo(currentDir) {
  const parts = [];
  if (existsSync(join(currentDir, "package.json"))) {
    if (commandExists("bun")) {
      const v = run("bun --version");
      if (v)
        parts.push(`(bun:${v})`);
    } else if (commandExists("node")) {
      const v = run("node --version")?.replace(/^v/, "");
      if (v)
        parts.push(`node:${v}`);
    }
  }
  if (existsSync(join(currentDir, "pyproject.toml")) || existsSync(join(currentDir, "setup.py")) || existsSync(join(currentDir, "requirements.txt"))) {
    if (commandExists("python3")) {
      const v = run("python3 --version")?.split(" ")[1];
      if (v)
        parts.push(`py:${v}`);
    }
  }
  if (existsSync(join(currentDir, "go.mod"))) {
    if (commandExists("go")) {
      const v = run("go version")?.match(/go(\S+)/)?.[1];
      if (v)
        parts.push(`go:${v}`);
    }
  }
  if (existsSync(join(currentDir, "Cargo.toml"))) {
    if (commandExists("rustc")) {
      const v = run("rustc --version")?.split(" ")[1];
      if (v)
        parts.push(`rust:${v}`);
    }
  }
  return parts.join(" ");
}
function main() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const rawInput = Buffer.concat(chunks).toString();
    let input;
    try {
      input = JSON.parse(rawInput);
    } catch {
      process.stdout.write("nerdo-claude (parse error)");
      return;
    }
    const modelName = input.model?.display_name ?? "Unknown";
    const outputStyle = input.output_style?.name ?? "default";
    const currentDir = input.workspace?.current_dir ?? input.cwd ?? process.cwd();
    const projectDir = input.workspace?.project_dir ?? input.workspace?.current_dir ?? input.cwd ?? process.cwd();
    const dir = getDirectoryDisplay(currentDir, projectDir);
    const langInfo = getLangInfo(currentDir);
    const tokenDisplay = getTokenDisplay(input.context_window);
    const jjInfo = getJjInfo();
    let line = `${reset}${dir.emoji} ${white}${dir.name}${reset}`;
    if (langInfo) {
      line += `${dimmed} ${langInfo}${reset}`;
    }
    line += "  \uD83E\uDD16 ";
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
