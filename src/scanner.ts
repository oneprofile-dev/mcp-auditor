import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ClientLabel, MCPServerEntry } from "./types.js";

interface ConfigFile {
  filePath: string;
  servers: MCPServerEntry[];
}

interface ConfigLocation {
  filePath: string;
  client: ClientLabel;
  // "claude-code" = ~/.claude.json, which nests servers globally AND per-project
  format?: "claude-code";
}

// All known MCP config locations, keyed by platform
function getConfigLocations(): ConfigLocation[] {
  const home = os.homedir();
  const platform = process.platform;
  const appdata = process.env.APPDATA ?? "";

  const locations: ConfigLocation[] = [
    // Claude Code — legacy user-level location
    { filePath: path.join(home, ".claude", "mcp.json"), client: "Claude Code" },
    // Claude Code — legacy project-level (current working directory)
    { filePath: path.join(process.cwd(), ".claude", "mcp.json"), client: "Claude Code" },
    // Claude Code — current user-level config (global + per-project servers)
    { filePath: path.join(home, ".claude.json"), client: "Claude Code", format: "claude-code" },
    // Claude Code — project-shared config (checked into repos)
    { filePath: path.join(process.cwd(), ".mcp.json"), client: "Claude Code" },
    // VS Code / GitHub Copilot — project-level
    { filePath: path.join(process.cwd(), ".vscode", "mcp.json"), client: "GitHub Copilot" },
    // Gemini CLI
    { filePath: path.join(home, ".gemini", "settings.json"), client: "Gemini CLI" },
  ];

  if (platform === "darwin" || platform === "linux") {
    locations.push(
      // Claude Desktop (macOS)
      { filePath: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"), client: "Claude Desktop" },
      // Cursor (macOS/Linux)
      { filePath: path.join(home, ".cursor", "mcp.json"), client: "Cursor" },
      // Windsurf (macOS/Linux)
      { filePath: path.join(home, ".codeium", "windsurf", "mcp_config.json"), client: "Windsurf" },
      // VS Code / GitHub Copilot — user-level (macOS)
      { filePath: path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"), client: "GitHub Copilot" },
    );
  }

  if (platform === "win32") {
    locations.push(
      // Claude Desktop (Windows)
      { filePath: path.join(appdata, "Claude", "claude_desktop_config.json"), client: "Claude Desktop" },
      // Cursor (Windows)
      { filePath: path.join(appdata, ".cursor", "mcp.json"), client: "Cursor" },
      // Windsurf (Windows)
      { filePath: path.join(appdata, "Codeium", "Windsurf", "mcp_config.json"), client: "Windsurf" },
      // VS Code / GitHub Copilot — user-level (Windows)
      { filePath: path.join(appdata, "Code", "User", "mcp.json"), client: "GitHub Copilot" },
    );
  }

  return locations;
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
        type: typeof d.type === "string" ? d.type : undefined,
        sourceFile: filePath,
        client,
      };
    });
}

function parseConfig(
  filePath: string,
  client: ClientLabel,
  format?: "claude-code"
): MCPServerEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
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
