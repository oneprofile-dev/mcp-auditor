/**
 * Remote endpoint checks. Runs fully offline: no URL is ever fetched.
 *
 * Two kinds of finding:
 *  - KNOWN_BAD: the endpoint is on CuratedMCP's list of MCP entries seen
 *    behaving maliciously in public registries (see KNOWN_BAD below).
 *  - RISKY_ENDPOINT: the address itself is a pattern with no good reason to
 *    appear in an MCP config: a cloud metadata address, a wildcard-DNS host
 *    that resolves to an IP of the attacker's choosing, an anonymous tunnel,
 *    a raw public IP, or plain http to a non-local host.
 *
 * Plain localhost / loopback / private addresses are NOT flagged: running
 * your own MCP server locally is normal.
 */

export interface KnownBadEntry {
  /** Matched against the endpoint as a case-insensitive prefix (scheme://host[:port]/path). */
  prefix: string;
  reason: string;
  /** Where we saw it, and when it was added. */
  source: string;
  added: string;
}

export const KNOWN_BAD_UPDATED = "2026-11-26";

// Seen in the official MCP registry under io.github.zz959397ghb (reported
// privately to the registry maintainers on 2026-11-24). Remote entries point at
// short-lived tunnels and at internal addresses, a pattern used to probe tools
// that fetch registry URLs.
const ZZ = "Official MCP registry, io.github.zz959397ghb entries (reported Nov 24, 2026)";
export const KNOWN_BAD: KnownBadEntry[] = [
  "https://ngtpl-216-175-194-204.free.pinggy.net/",
  "https://tbedp-103-249-185-131.run.pinggy-free.link/",
  "https://vsxqh-103-5-250-195.run.pinggy-free.link/",
  "https://mrtmv-192-220-248-84.free.pinggy.net/",
  "https://nibyc-207-145-4-71.free.pinggy.net/",
  "https://jscya-216-132-151-101.free.pinggy.net/",
  "https://zmpeb-103-5-250-95.free.pinggy.net/",
  "https://vmlzp-207-145-4-71.free.pinggy.net/",
  "https://xzvzl-49-128-222-220.free.pinggy.net/",
  "https://wjqhi-204-237-146-161.run.pinggy-free.link/",
].map((prefix) => ({
  prefix,
  reason: "Tunnel endpoint published by a registry account that also published cloud-metadata and internal-address entries",
  source: ZZ,
  added: "2026-11-24",
}));

/** Registry names (reverse-DNS) on the known-bad list, matched as a prefix. */
export const KNOWN_BAD_NAMES: { prefix: string; source: string }[] = [
  { prefix: "io.github.zz959397ghb/", source: ZZ },
];

const METADATA_HOSTS = new Set([
  "169.254.169.254",          // AWS, Azure, GCP, OpenStack
  "169.254.170.2",            // AWS ECS task metadata
  "fd00:ec2::254",            // AWS IPv6 metadata
  "100.100.100.200",          // Alibaba Cloud
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
]);

// Wildcard DNS services: <ip>.nip.io resolves to <ip>, so a "domain" can hide
// an internal or loopback address.
const WILDCARD_DNS = [/\.nip\.io$/, /\.sslip\.io$/, /\.xip\.io$/, /\.traefik\.me$/, /\.localtest\.me$/, /(^|\.)lvh\.me$/, /\.backname\.io$/];

// Anonymous, short-lived tunnels: the operator is unknown and the address can
// point somewhere else tomorrow.
const TUNNELS = [
  /\.pinggy\.(net|link|io)$/, /\.pinggy-free\.link$/, /\.ngrok(-free)?\.(app|dev|io)$/, /\.ngrok\.io$/,
  /\.trycloudflare\.com$/, /\.loca\.lt$/, /\.serveo\.net$/, /\.localhost\.run$/, /\.lhr\.life$/,
  /\.bore\.pub$/, /\.tunnelmole\.net$/, /\.devtunnels\.ms$/,
];

export interface EndpointFinding {
  url: string;
  kind: "KNOWN_BAD" | "RISKY_ENDPOINT";
  reason: string;
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isIPv4(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

function isLocalHost(h: string): boolean {
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "0.0.0.0") return true;
  if (isIPv4(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (!h.includes(":")) return false;
  const l = h.toLowerCase();
  return l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80:");
}

/** Pull http(s) URLs out of a config entry: url field plus any args (mcp-remote, supergateway...). */
export function endpointsOf(url?: string, args?: string[]): string[] {
  const out = new Set<string>();
  if (url && /^https?:\/\//i.test(url.trim())) out.add(url.trim());
  for (const a of args ?? []) {
    const m = a.match(/https?:\/\/[^\s"'<>]+/i);
    if (m) out.add(m[0]);
  }
  return [...out];
}

export function checkEndpoint(raw: string): EndpointFinding | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const lower = raw.toLowerCase();
  const bad = KNOWN_BAD.find((k) => lower.startsWith(k.prefix.toLowerCase()));
  if (bad) return { url: redactEndpoint(raw), kind: "KNOWN_BAD", reason: `${bad.reason}. Source: ${bad.source}.` };

  const host = stripBrackets(u.hostname.toLowerCase());

  if (METADATA_HOSTS.has(host)) {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Cloud metadata address: it can hand out the machine's cloud credentials" };
  }
  if (WILDCARD_DNS.some((r) => r.test(host))) {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Wildcard-DNS host: the name resolves to whatever IP is written in it, often an internal one" };
  }
  if (TUNNELS.some((r) => r.test(host))) {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Anonymous tunnel: the operator is unknown and the address can change hands" };
  }
  if (isLocalHost(host)) return null;
  if (isIPv4(host) || host.includes(":")) {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Raw public IP address instead of a named, accountable host" };
  }
  if (u.protocol === "http:") {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Plain http to a remote host: requests and any tokens travel unencrypted" };
  }
  if (u.username || u.password) {
    return { url: redactEndpoint(raw), kind: "RISKY_ENDPOINT", reason: "Credentials written into the URL" };
  }
  return null;
}

/** For display: scheme, host and path only, so tokens in a query string are never printed. */
export function redactEndpoint(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return raw.slice(0, 80);
  }
}

/** Canonical form used to match a configured endpoint to a catalog listing. */
export function normalizeEndpoint(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return null;
  }
}
