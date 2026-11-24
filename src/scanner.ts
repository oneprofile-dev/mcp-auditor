import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ClientLabel, MCPServerEntry } from "./types.js";
import { parseCodexToml } from "./toml.js";

interface ConfigFile {
  filePath: string;
  servers: MCPServerEntry[];
}

// "claude-code" = ~/.claude.json, which nests servers globally AND per-project.
// "codex-toml"  = Codex config.toml, servers under [mcp_servers.<name>].
type ConfigFormat = "claude-code" | "codex-toml";

interface ConfigLocation {
  filePath: string;
  client: ClientLabel;
  format?: ConfigFormat;
}

// All known MCP config locations, keyed by platform
function getConfigLocations(): ConfigLocation[] {
  const home = os.homedir();
  const platform = process.platform;
  const appdata = process.env.APPDATA ?? "";
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  const codexHome = process.env.CODEX_HOME ?? path.join(home, ".codex");

  // Same on every platform (home-relative or project-relative)
  const locations: ConfigLocation[] = [
    // Claude Code: legacy user-level and project-level locations
    { filePath: path.join(home, ".claude", "mcp.json"), client: "Claude Code" },
    { filePath: path.join(process.cwd(), ".claude", "mcp.json"), client: "Claude Code" },
    // Claude Code: current user-level config (global + per-project servers)
    { filePath: path.join(home, ".claude.json"), client: "Claude Code", format: "claude-code" },
    // Claude Code: project-shared config (checked into repos)
    { filePath: path.join(process.cwd(), ".mcp.json"), client: "Claude Code" },
    // VS Code / GitHub Copilot: project-level
    { filePath: path.join(process.cwd(), ".vscode", "mcp.json"), client: "GitHub Copilot" },
    // Gemini CLI
    { filePath: path.join(home, ".gemini", "settings.json"), client: "Gemini CLI" },
    // Cursor uses ~/.cursor on every OS (%USERPROFILE%\.cursor on Windows)
    { filePath: path.join(home, ".cursor", "mcp.json"), client: "Cursor" },
    { filePath: path.join(process.cwd(), ".cursor", "mcp.json"), client: "Cursor" },
    // Windsurf
    { filePath: path.join(home, ".codeium", "windsurf", "mcp_config.json"), client: "Windsurf" },
    // OpenAI Codex CLI and IDE extension: TOML, user-level and project-level
    { filePath: path.join(codexHome, "config.toml"), client: "Codex", format: "codex-toml" },
    { filePath: path.join(process.cwd(), ".codex", "config.toml"), client: "Codex", format: "codex-toml" },
  ];

  if (platform === "darwin") {
    locations.push(
      { filePath: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"), client: "Claude Desktop" },
      { filePath: path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"), client: "GitHub Copilot" },
    );
  }

  if (platform === "linux") {
    locations.push(
      { filePath: path.join(xdg, "Claude", "claude_desktop_config.json"), client: "Claude Desktop" },
      { filePath: path.join(xdg, "Code", "User", "mcp.json"), client: "GitHub Copilot" },
    );
  }

  if (platform === "win32") {
    locations.push(
      { filePath: path.join(appdata, "Claude", "claude_desktop_config.json"), client: "Claude Desktop" },
      { filePath: path.join(appdata, "Code", "User", "mcp.json"), client: "GitHub Copilot" },
    );
  }

  // The same file can appear twice (e.g. cwd is the home directory)
  const seen = new Set<string>();
  return locations.filter((l) => !seen.has(l.filePath) && seen.add(l.filePath));
}

function stringRecord(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

function entriesFrom(
  servers: Record<string, unknown>,
  filePath: string,
  client: ClientLabel
): MCPServerEntry[] {
  return Object.entries(servers).map(([name, def]: [string, unknown]) => {
      const d = def as Record<string, unknown>;
      return {
        name,
        command: typeof d.command === "string" ? d.command : undefined,
        args: Array.isArray(d.args) ? (d.args as string[]) : undefined,
        env: typeof d.env === "object" && d.env !== null
          ? (d.env as Record<string, string>)
          : undefined,
        url: typeof d.url === "string" ? d.url : undefined,
        headers: stringRecord(d.headers ?? d.http_headers),
        type: typeof d.type === "string" ? d.type : undefined,
        sourceFile: filePath,
        client,
      };
    });
}

function parseConfig(
  filePath: string,
  client: ClientLabel,
  format?: ConfigFormat
): MCPServerEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    if (format === "codex-toml") return entriesFrom(parseCodexToml(raw), filePath, client);
    const json = JSON.parse(raw);

    if (format === "claude-code") {
      // ~/.claude.json — global mcpServers plus per-project mcpServers blocks.
      // De-dupe by server name: the same server registered in several projects
      // is still one server on this machine.
      const merged: Record<string, unknown> = { ...(json.mcpServers ?? {}) };
      const projects = (json.projects ?? {}) as Record<string, { mcpServers?: Record<string, unknown> }>;
      for (const proj of Object.values(projects)) {
        for (const [name, def] of Object.entries(proj?.mcpServers ?? {})) {
          if (!(name in merged)) merged[name] = def;
        }
      }
      return entriesFrom(merged, filePath, client);
    }

    // VS Code's mcp.json nests under "servers"; everything else uses "mcpServers"
    const servers = json.mcpServers ?? json.servers ?? {};
    return entriesFrom(servers, filePath, client);
  } catch {
    return [];
  }
}

export function scanConfigs(): ConfigFile[] {
  const results: ConfigFile[] = [];
  for (const { filePath, client, format } of getConfigLocations()) {
    if (fs.existsSync(filePath)) {
      const servers = parseConfig(filePath, client, format);
      results.push({ filePath, servers });
    }
  }
  return results;
}
