export type RiskFlag =
  | "FILE_SYSTEM_ACCESS"
  | "KEYCHAIN_ACCESS"
  | "CREDENTIAL_IN_ENV"
  | "NETWORK_ACCESS"
  | "UNVERIFIED";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "VERIFIED";

// Client labels accepted by the curatedmcp.com report API — keep in sync
// with lib/shadow-scan.ts in the marketplace repo.
export type ClientLabel =
  | "Claude Code"
  | "Claude Desktop"
  | "Cursor"
  | "Windsurf"
  | "GitHub Copilot"
  | "Gemini CLI"
  | "Other";

export interface MCPServerEntry {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;           // for HTTP-type servers
  type?: string;
  sourceFile: string;
  client: ClientLabel;
}

export interface AnalyzedServer {
  name: string;
  sourceFile: string;
  client: ClientLabel;
  command?: string;
  flags: RiskFlag[];
  level: RiskLevel;
  npmPackage?: string;    // extracted from command, if any
}

export interface AuditReport {
  scannedAt: string;
  configFiles: string[];
  totalServers: number;
  high: AnalyzedServer[];
  medium: AnalyzedServer[];
  verified: AnalyzedServer[];
  unverified: AnalyzedServer[];  // no risk flags but not in catalog
}
