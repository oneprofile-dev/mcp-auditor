#!/usr/bin/env node
import { scanConfigs } from "./scanner.js";
import { analyzeServer } from "./risk.js";
import { getCatalog } from "./catalog.js";
import { printReport, printJson } from "./report.js";
import type { AuditReport, AnalyzedServer } from "./types.js";

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const noFetch = args.includes("--offline");

  // Load catalog (skip fetch in offline mode)
  const catalog = noFetch
    ? { slugs: new Set<string>(), npm: new Set<string>() }
    : await getCatalog();

  // Scan all config files
  const configFiles = scanConfigs();

  const allServers: AnalyzedServer[] = [];
  const foundFiles: string[] = [];

  for (const { filePath, servers } of configFiles) {
    if (servers.length > 0) foundFiles.push(filePath);
    for (const server of servers) {
      allServers.push(analyzeServer(server, catalog.slugs, catalog.npm));
    }
  }

  const report: AuditReport = {
    scannedAt: new Date().toLocaleString(),
    configFiles: foundFiles,
    totalServers: allServers.length,
    high:       allServers.filter((s) => s.level === "HIGH"),
    medium:     allServers.filter((s) => s.level === "MEDIUM"),
    verified:   allServers.filter((s) => s.level === "VERIFIED"),
    unverified: allServers.filter((s) => s.level === "LOW"),
  };

  if (jsonMode) {
    printJson(report);
  } else {
    await printReport(report);
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
