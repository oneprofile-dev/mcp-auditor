import type { AuditReport, AnalyzedServer } from "./types.js";

// Chalk is ESM-only in v5, we import dynamically
let chalk: typeof import("chalk").default;

async function getChalk() {
  if (!chalk) {
    const m = await import("chalk");
    chalk = m.default;
  }
  return chalk;
}

const FLAG_LABELS: Record<string, string> = {
  FILE_SYSTEM_ACCESS: "FILE_SYSTEM_ACCESS",
  KEYCHAIN_ACCESS:    "KEYCHAIN_ACCESS",
  CREDENTIAL_IN_ENV:  "CREDENTIAL_IN_ENV",
  NETWORK_ACCESS:     "NETWORK_ACCESS",
  UNVERIFIED:         "UNVERIFIED",
};

export async function printReport(report: AuditReport): Promise<void> {
  const c = await getChalk();

  console.log("\n" + c.bold("MCP Security Audit") + c.dim(` — ${report.scannedAt}`));
  console.log(c.dim("━".repeat(50)));
  console.log();

  if (report.configFiles.length === 0) {
    console.log(c.yellow("No MCP configuration files found on this machine."));
    console.log(c.dim("Install Claude Desktop, Cursor, or Claude Code to get started."));
    console.log();
    return;
  }

  console.log(c.dim(`Found ${report.configFiles.length} config file${report.configFiles.length !== 1 ? "s" : ""}. ${report.totalServers} server${report.totalServers !== 1 ? "s" : ""} detected.`));
  for (const f of report.configFiles) {
    console.log(c.dim(`  ✓ ${f}`));
  }
  console.log();

  if (report.high.length > 0) {
    console.log(c.red.bold(`HIGH RISK (${report.high.length})`));
    for (const s of report.high) {
      printServer(c, s, "red");
    }
    console.log();
  }

  if (report.medium.length > 0) {
    console.log(c.yellow.bold(`MEDIUM RISK (${report.medium.length})`));
    for (const s of report.medium) {
      printServer(c, s, "yellow");
    }
    console.log();
  }

  if (report.unverified.length > 0) {
    console.log(c.dim(`UNVERIFIED (${report.unverified.length}) — not in the CuratedMCP catalog`));
    for (const s of report.unverified) {
      console.log(c.dim(`  ? ${s.name}`));
      console.log(c.dim(`    ${s.sourceFile}`));
    }
    console.log();
  }

  if (report.verified.length > 0) {
    console.log(c.green(`VERIFIED (${report.verified.length})`));
    const names = report.verified.map((s) => s.name).join(", ");
    console.log(c.dim(`  ✓ ${names}`));
    console.log();
  }

  // Upgrade prompt — shown when HIGH risks exist and no key configured
  const licenseKey = process.env.CURATEDMCP_KEY ?? process.env.MCP_AUDITOR_KEY;
  if (report.high.length > 0 && !licenseKey) {
    console.log(c.dim("─".repeat(50)));
    console.log(
      c.yellow.bold("  ⚡ Auditor Pro") +
        c.dim(" — get weekly email alerts for new risks")
    );
    console.log(
      c.dim("  Set up automated monitoring: ") +
        c.cyan("https://curatedmcp.com/auditor#pro")
    );
    console.log(c.dim("─".repeat(50)));
  } else if (licenseKey) {
    console.log(c.dim("Syncing scan results…"));
    await syncResults(report, licenseKey).catch(() => {
      console.log(c.dim("Sync skipped (offline or invalid key)."));
    });
  } else {
    console.log(
      c.dim("Automate this scan → ") +
        c.cyan("https://curatedmcp.com/auditor#pro")
    );
  }
  console.log();
}

async function syncResults(
  report: AuditReport,
  key: string
): Promise<void> {
  const payload = {
    key,
    scannedAt: report.scannedAt,
    totalServers: report.totalServers,
    configFiles: report.configFiles,
    high: report.high.map((s) => ({
      name: s.name,
      flags: s.flags,
      command: s.command ?? null,
      sourceFile: s.sourceFile,
    })),
    medium: report.medium.map((s) => ({
      name: s.name,
      flags: s.flags,
      command: s.command ?? null,
      sourceFile: s.sourceFile,
    })),
    unverified: report.unverified.map((s) => ({ name: s.name, sourceFile: s.sourceFile })),
    verified: report.verified.map((s) => ({ name: s.name })),
  };

  const res = await fetch("https://curatedmcp.com/api/v1/auditor/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (res.ok) {
    const c = await getChalk();
    console.log(c.green("  ✓ Scan synced — check your email for any new risk alerts."));
  }
}

function printServer(
  c: typeof import("chalk").default,
  s: AnalyzedServer,
  color: "red" | "yellow"
): void {
  const flagStr = s.flags.map((f) => FLAG_LABELS[f]).join(", ");
  console.log(c[color](`  ⚠ ${s.name}`) + c.dim(` — ${flagStr}`));
  console.log(c.dim(`    ${s.sourceFile}`));
  if (s.command) console.log(c.dim(`    ${s.command}`));
}

export function printJson(report: AuditReport): void {
  console.log(JSON.stringify(report, null, 2));
}
