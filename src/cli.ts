#!/usr/bin/env node
import { scanConfigs } from "./scanner.js";
import { analyzeServer } from "./risk.js";
import { getCatalog, EMPTY_CATALOG } from "./catalog.js";
import { printReport, printJson, printShareResult, printShareHint } from "./report.js";
import { uploadReport, confirmShare } from "./share.js";
import type { AuditReport, AnalyzedServer } from "./types.js";

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const noFetch = args.includes("--offline");
  const shareFlag = args.includes("--share");
  const noShare = args.includes("--no-share");

  // Load catalog (skip fetch in offline mode)
  const catalog = noFetch ? EMPTY_CATALOG : await getCatalog();

  // Scan all config files
  const configFiles = scanConfigs();

  const allServers: AnalyzedServer[] = [];
  const foundFiles: string[] = [];

  for (const { filePath, servers } of configFiles) {
    if (servers.length > 0) foundFiles.push(filePath);
    for (const server of servers) {
      allServers.push(analyzeServer(server, catalog));
    }
  }

  const report: AuditReport = {
    scannedAt: new Date().toLocaleString(),
    configFiles: foundFiles,
    totalServers: allServers.length,
    high:       allServers.filter((s) => s.level === "HIGH"),
    medium:     allServers.filter((s) => s.level === "MEDIUM"),
    verified:   allServers.filter((s) => s.level === "VERIFIED"),
    listed:     allServers.filter((s) => s.level === "LISTED"),
    unverified: allServers.filter((s) => s.level === "LOW"),
  };

  if (jsonMode) {
    printJson(report);
  } else {
    await printReport(report, { offline: noFetch });
  }

  // Shareable web report — opt-in. `--share` skips the prompt; in a TTY we
  // ask; non-interactive runs (CI, pipes) never upload without --share.
  const canShare = !noFetch && !noShare && !jsonMode && report.totalServers > 0;
  if (canShare) {
    const wantShare = shareFlag || (process.stdin.isTTY ? await confirmShare() : false);
    if (wantShare) {
      const result = await uploadReport(report);
      await printShareResult(result);
    } else if (!shareFlag) {
      await printShareHint();
    }
  }

  // Exit with non-zero if high risk servers found
  if (report.high.length > 0 && !jsonMode) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
