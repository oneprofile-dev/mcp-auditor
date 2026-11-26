// Run with: npm test (builds first). Uses node:test, no extra dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeServer, extractNpmPackage, extractPypiPackage } from "../dist/risk.js";
import { buildCatalog, EMPTY_CATALOG } from "../dist/catalog.js";
import { checkEndpoint, normalizeEndpoint } from "../dist/endpoints.js";

const catalog = buildCatalog([
  { slug: "github-mcp", name: "GitHub", npm: "@modelcontextprotocol/server-github" },
  { slug: "botsrated-beta", name: "BotsRated", url: "https://botsrated.com/mcp", verified: true },
  { slug: "fetch-mcp", name: "Fetch", pypi: "mcp-server-time", verified: true },
]);

const entry = (o) => ({ name: "x", sourceFile: "/tmp/mcp.json", client: "Cursor", ...o });

test("config key name alone never makes a server Listed or Verified", () => {
  const s = analyzeServer(entry({ name: "github-mcp", command: "npx", args: ["-y", "totally-other-pkg"] }), catalog);
  assert.equal(s.level, "LOW");
  assert.ok(s.flags.includes("UNVERIFIED"));
});

test("approved listing is LISTED, not VERIFIED", () => {
  const s = analyzeServer(entry({ command: "npx", args: ["-y", "@modelcontextprotocol/server-github@latest"] }), catalog);
  assert.equal(s.level, "LISTED");
  assert.equal(s.catalogSlug, "github-mcp");
});

test("remote server matches its catalog endpoint and shows VERIFIED only when reviewed", () => {
  const s = analyzeServer(entry({ url: "https://botsrated.com/mcp/" }), catalog);
  assert.equal(s.level, "VERIFIED");
});

test("uvx package matches PyPI listing", () => {
  const s = analyzeServer(entry({ command: "uvx", args: ["mcp-server-time"] }), catalog);
  assert.equal(s.level, "VERIFIED");
});

test("known-bad endpoint is HIGH even when other checks pass", () => {
  const s = analyzeServer(entry({ url: "https://ngtpl-216-175-194-204.free.pinggy.net/m30/mcp" }), catalog);
  assert.equal(s.level, "HIGH");
  assert.ok(s.flags.includes("KNOWN_BAD"));
});

test("known-bad endpoint behind mcp-remote is caught", () => {
  const s = analyzeServer(entry({ command: "npx", args: ["-y", "mcp-remote", "https://zmpeb-103-5-250-95.free.pinggy.net/m51/mcp"] }), catalog);
  assert.ok(s.flags.includes("KNOWN_BAD"));
});

test("known-bad registry name is caught", () => {
  const s = analyzeServer(entry({ name: "io.github.zz959397ghb/zzm30", url: "https://example.com/mcp" }), catalog);
  assert.ok(s.flags.includes("KNOWN_BAD"));
});

test("risky endpoint patterns", () => {
  for (const u of [
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1.nip.io:10000/openapi.json",
    "https://abc.ngrok-free.app/mcp",
    "https://abc.trycloudflare.com/mcp",
    "http://mcp.example.com/mcp",
    "https://203.0.113.9/mcp",
    "http://metadata.google.internal/computeMetadata/v1/",
  ]) {
    assert.equal(checkEndpoint(u)?.kind, "RISKY_ENDPOINT", u);
  }
});

test("local and normal endpoints are not flagged", () => {
  for (const u of [
    "http://localhost:3000/mcp",
    "http://127.0.0.1:8080/sse",
    "http://192.168.1.20:9000/mcp",
    "https://mcp.linear.app/sse",
    "https://fdsomething.example.com/mcp",
    "https://mcp.apify.com?tools=publicrecords/grants-gov-scraper",
  ]) {
    assert.equal(checkEndpoint(u), null, u);
  }
});

test("printed endpoint never includes the query string", () => {
  const f = checkEndpoint("http://mcp.example.com/mcp?token=supersecret");
  assert.ok(f && !f.url.includes("supersecret"));
});

test("risk flags on an unknown server are HIGH; on a catalog server MEDIUM", () => {
  const unknown = analyzeServer(entry({ command: "npx", args: ["-y", "some-pkg"], env: { API_TOKEN: "x" } }), catalog);
  assert.equal(unknown.level, "HIGH");
  const known = analyzeServer(entry({ command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: { GITHUB_TOKEN: "x" } }), catalog);
  assert.equal(known.level, "MEDIUM");
});

test("offline: empty catalog never yields Listed or Verified", () => {
  const s = analyzeServer(entry({ url: "https://botsrated.com/mcp" }), EMPTY_CATALOG);
  assert.equal(s.level, "LOW");
});

test("package extraction", () => {
  assert.equal(extractNpmPackage("npx", ["-y", "@scope/pkg@1.2.3", "--flag"]), "@scope/pkg");
  assert.equal(extractNpmPackage("/usr/local/bin/npx", ["pkg@latest"]), "pkg");
  assert.equal(extractNpmPackage("pnpm", ["dlx", "@a/b"]), "@a/b");
  assert.equal(extractNpmPackage("node", ["/x/index.js"]), undefined);
  assert.equal(extractPypiPackage("uvx", ["--python", "3.12", "mcp-server-fetch==0.6"]), "mcp-server-fetch");
  assert.equal(extractPypiPackage("pipx", ["run", "pkg-a"]), "pkg-a");
});

test("endpoint normalization", () => {
  assert.equal(normalizeEndpoint("https://BotsRated.com/mcp/"), "https://botsrated.com/mcp");
  assert.equal(normalizeEndpoint("https://mcp.apify.com?tools=a/b"), "https://mcp.apify.com?tools=a/b");
});
