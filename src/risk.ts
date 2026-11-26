import type { MCPServerEntry, RiskFlag, RiskLevel, AnalyzedServer } from "./types.js";
import type { Catalog, CatalogMatch } from "./catalog.js";
import { checkEndpoint, endpointsOf, normalizeEndpoint, KNOWN_BAD_NAMES } from "./endpoints.js";

const CREDENTIAL_PATTERN = /SECRET|TOKEN|PASSWORD|KEY|APIKEY|API_KEY|PRIVATE|AUTH/i;
const FILESYSTEM_ARGS = /--allow-write|--allow-read|--allow-all|\/Users|\/home|\/var|C:\\/i;
// A header value that only points at an env var, e.g. "Bearer ${API_KEY}" or "${env:TOKEN}".
const REFERENCE_ONLY = /^(Bearer\s+)?\$\{[^}]+\}$/i;
const KEYCHAIN_CMDS = /keychain|security\s+find|secret-tool|kwallet/i;
const NETWORK_CMDS = /curl|wget|fetch|http/i;

const base = (cmd?: string) => (cmd ?? "").split(/[\\/]/).pop()?.replace(/\.(cmd|exe)$/i, "") ?? "";

/** Strip a version suffix: "@scope/pkg@1.2.3" -> "@scope/pkg", "pkg@latest" -> "pkg". */
function stripVersion(spec: string): string {
  const at = spec.lastIndexOf("@");
  return at > 0 ? spec.slice(0, at) : spec;
}

function firstPositional(args: string[], valueFlags: RegExp): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (valueFlags.test(a) && !a.includes("=")) i++; // skip the flag's value
      continue;
    }
    return a;
  }
  return undefined;
}

export function extractNpmPackage(command?: string, args?: string[]): string | undefined {
  const b = base(command);
  if (!args?.length) return undefined;
  if (b === "npx" || b === "bunx" || b === "pnpx") {
    const pkg = firstPositional(args, /^(-p|--package|--node-options|--cache)$/);
    return pkg ? stripVersion(pkg) : undefined;
  }
  if ((b === "pnpm" || b === "yarn") && args[0] === "dlx") {
    const pkg = firstPositional(args.slice(1), /^(-p|--package)$/);
    return pkg ? stripVersion(pkg) : undefined;
  }
  return undefined;
}

export function extractPypiPackage(command?: string, args?: string[]): string | undefined {
  const b = base(command);
  if (!args?.length) return undefined;
  let rest = args;
  if (b === "pipx" && args[0] === "run") rest = args.slice(1);
  else if (b !== "uvx") return undefined;
  const pkg = firstPositional(rest, /^(--from|--with|--python|-p|--index-url)$/);
  return pkg ? pkg.split(/[=<>~!@[]/)[0] : undefined;
}

export function analyzeServer(server: MCPServerEntry, catalog: Catalog): AnalyzedServer {
  const flags: RiskFlag[] = [];
  const cmdLine = [server.command, ...(server.args ?? [])].join(" ");
  const npmPackage = extractNpmPackage(server.command, server.args);
  const pypiPackage = extractPypiPackage(server.command, server.args);
  const endpoints = endpointsOf(server.url, server.args);

  // Known-bad and risky remote endpoints (offline check, nothing is fetched)
  const findings = endpoints
    .map(checkEndpoint)
    .filter((f): f is NonNullable<ReturnType<typeof checkEndpoint>> => f !== null);
  const nameHit = KNOWN_BAD_NAMES.find(
    (n) => cmdLine.toLowerCase().includes(n.prefix.toLowerCase()) || server.name.toLowerCase().startsWith(n.prefix.toLowerCase())
  );
  if (nameHit) {
    findings.push({ url: nameHit.prefix, kind: "KNOWN_BAD", reason: `Registry name on the known-bad list. Source: ${nameHit.source}.` });
  }
  if (findings.some((f) => f.kind === "KNOWN_BAD")) flags.push("KNOWN_BAD");
  if (findings.some((f) => f.kind === "RISKY_ENDPOINT")) flags.push("RISKY_ENDPOINT");

  // File system access
  if (FILESYSTEM_ARGS.test(cmdLine)) flags.push("FILE_SYSTEM_ACCESS");

  // Keychain access
  if (KEYCHAIN_CMDS.test(cmdLine)) flags.push("KEYCHAIN_ACCESS");

  // Credentials stored in the config: an env block with secret-looking keys,
  // or an HTTP header (Authorization, X-API-Key...) holding a literal value
  // rather than a reference like ${VAR} or env:VAR.
  const envHasSecret = server.env != null && CREDENTIAL_PATTERN.test(Object.keys(server.env).join(" "));
  const headerHasSecret = Object.entries(server.headers ?? {}).some(
    ([k, v]) => CREDENTIAL_PATTERN.test(k) && v.trim() !== "" && !REFERENCE_ONLY.test(v.trim())
  );
  if (envHasSecret || headerHasSecret) flags.push("CREDENTIAL_IN_ENV");

  // Network access (non-npx commands that fetch data)
  if (server.command !== "npx" && server.command !== "node" && NETWORK_CMDS.test(cmdLine)) {
    flags.push("NETWORK_ACCESS");
  }

  // Catalog status: by what actually runs, never by the config key's name.
  let match: CatalogMatch | undefined =
    (npmPackage && catalog.byNpm.get(npmPackage.toLowerCase())) ||
    (pypiPackage && catalog.byPypi.get(pypiPackage.toLowerCase())) ||
    undefined;
  if (!match) {
    for (const e of endpoints) {
      const n = normalizeEndpoint(e);
      const m = n ? catalog.byUrl.get(n) : undefined;
      if (m) { match = m; break; }
    }
  }
  if (!match) flags.push("UNVERIFIED");

  const riskFlags = flags.filter((f) => f !== "UNVERIFIED");
  let level: RiskLevel;
  if (flags.includes("KNOWN_BAD")) level = "HIGH";
  else if (riskFlags.length > 0 && !match) level = "HIGH";
  else if (riskFlags.length > 0) level = "MEDIUM";   // risk flags, but a catalog server
  else if (!match) level = "LOW";                    // unknown server, no other flags
  else level = match.status;                         // "VERIFIED" or "LISTED"

  return {
    name: server.name,
    sourceFile: server.sourceFile,
    client: server.client,
    command: [server.command, ...(server.args ?? [])].filter(Boolean).join(" ") || undefined,
    flags,
    level,
    ...(npmPackage ? { npmPackage } : {}),
    ...(pypiPackage ? { pypiPackage } : {}),
    ...(match ? { catalogSlug: match.slug } : {}),
    ...(findings.length ? { findings } : {}),
  };
}
