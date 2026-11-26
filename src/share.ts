/**
 * Shareable web report upload.
 *
 * Privacy contract: only server names, the IDE each came from, npm package
 * names, and risk flags are uploaded. Commands, arguments, env values,
 * secrets, and file paths NEVER leave the machine — the server-side schema
 * rejects payloads that carry them.
 */
import * as readline from "readline";
import type { AnalyzedServer, AuditReport } from "./types.js";

const REPORT_URL =
  process.env.CURATEDMCP_REPORT_URL ?? "https://www.curatedmcp.com/api/v1/audit/report";

// Keep in sync with package.json — npx does not reliably set npm_package_version.
const CLI_VERSION = "1.5.0";

export interface ShareResult {
  url: string;
  badgeUrl: string;
  grade: string;
}

function sanitize(s: AnalyzedServer) {
  return {
    name: s.name.slice(0, 120),
    ...(s.npmPackage ? { npmPackage: s.npmPackage } : {}),
    client: s.client,
    flags: s.flags,
    level: s.level,
  };
}

// Report servers before 1.5 only know these values; used as a fallback if the
// site rejects the newer ones, so --share keeps working during a rollout.
const LEGACY_FLAGS = new Set(["FILE_SYSTEM_ACCESS", "KEYCHAIN_ACCESS", "CREDENTIAL_IN_ENV", "NETWORK_ACCESS", "UNVERIFIED"]);
function legacy(s: ReturnType<typeof sanitize>) {
  const flags = s.flags.flatMap((f) =>
    LEGACY_FLAGS.has(f) ? [f] : f === "KNOWN_BAD" || f === "RISKY_ENDPOINT" ? ["NETWORK_ACCESS" as const] : []
  );
  return { ...s, flags: [...new Set(flags)], level: s.level === "LISTED" ? "LOW" : s.level };
}

export async function uploadReport(report: AuditReport): Promise<ShareResult | null> {
  const servers = [
    ...report.high,
    ...report.medium,
    ...report.unverified,
    ...report.listed,
    ...report.verified,
  ].map(sanitize);

  const payload = {
    cliVersion: CLI_VERSION,
    platform: (["darwin", "linux", "win32"] as const).find((p) => p === process.platform),
    servers,
  };

  const post = (body: unknown) =>
    fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

  try {
    let res = await post(payload);
    if (res.status === 400) res = await post({ ...payload, servers: servers.map(legacy) });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string; badgeUrl?: string; grade?: string };
    if (!json.url) return null;
    return { url: json.url, badgeUrl: json.badgeUrl ?? "", grade: json.grade ?? "" };
  } catch {
    return null;
  }
}

/** Interactive y/N prompt — only used when stdin is a TTY. */
export function confirmShare(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      "\nGenerate a shareable web report? Uploads server names + risk flags only, never commands, env values, or paths. (y/N) ",
      (answer) => {
        rl.close();
        resolve(/^y(es)?$/i.test(answer.trim()));
      }
    );
  });
}
