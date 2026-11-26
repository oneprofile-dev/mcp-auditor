export type RiskFlag =
  | "FILE_SYSTEM_ACCESS"
  | "KEYCHAIN_ACCESS"
  | "CREDENTIAL_IN_ENV"
  | "NETWORK_ACCESS"
  | "KNOWN_BAD"        // endpoint or registry name on CuratedMCP's known-bad list
  | "RISKY_ENDPOINT"   // metadata address, wildcard DNS, anonymous tunnel, raw IP, plain http
  | "UNVERIFIED";      // not in the CuratedMCP catalog (key kept for API compatibility)

// VERIFIED: a human Verified Review was completed. LISTED: in the catalog
// (approved listing) but not Verified. LOW: unknown, no other flags.
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "LISTED" | "VERIFIED";

// Client labels accepted by the curatedmcp.com report API — keep in sync
// with lib/shadow-scan.ts in the marketplace repo.
export type ClientLabel =
  | "Claude Code"
  | "Claude Desktop"
  | "Cursor"
  | "Windsurf"
  | "GitHub Copilot"
  | "Gemini CLI"
  | "Codex"
  | "Other";

export interface MCPServerEntry {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;           // for HTTP-type servers
  headers?: Record<string, string>; // HTTP headers stored in the config
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
  pypiPackage?: string;   // extracted from uvx/pipx command, if any
  catalogSlug?: string;   // the matching curatedmcp.com listing, if any
  findings?: { url: string; kind: "KNOWN_BAD" | "RISKY_ENDPOINT"; reason: string }[];
}

export interface AuditReport {
  scannedAt: string;
  configFiles: string[];
  totalServers: number;
  high: AnalyzedServer[];
  medium: AnalyzedServer[];
  verified: AnalyzedServer[];    // human Verified Review done, no risk flags
  listed: AnalyzedServer[];      // in the catalog, not Verified, no risk flags
  unverified: AnalyzedServer[];  // no risk flags but not in catalog
}
