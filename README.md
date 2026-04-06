# @curatedmcp/auditor

Scan your machine for MCP (Model Context Protocol) servers and flag security risks. Works with Claude Desktop, Cursor, Claude Code, and Windsurf.

```
npx @curatedmcp/auditor
```

No installation required. Runs entirely on your machine — nothing is sent to any server except a read-only catalog lookup to check which servers are verified.

**[Auditor Pro](https://curatedmcp.com/auditor#pro) ($9/month)** — automated weekly scan alerts, immediate email when a new HIGH-risk server appears, and full scan history at [curatedmcp.com/dashboard/auditor](https://curatedmcp.com/dashboard/auditor).

---

## What it does

Finds every MCP server configured on your machine, then reports:

- **HIGH / MEDIUM / LOW** risk flags with explanations
- Which servers are **VERIFIED** in the CuratedMCP catalog vs unknown
- Credentials accidentally embedded in environment blocks
- Filesystem access or keychain access granted to unverified tools

Example output:

```
MCP Security Audit — 2026-03-31

Found 4 config files. 12 servers detected.

HIGH RISK (2)
  ⚠ filesystem-mcp — UNVERIFIED, FILE_SYSTEM_ACCESS
    ~/.cursor/mcp.json — npx filesystem-mcp --allow-write /Users

  ⚠ unknown-tool — UNVERIFIED, CREDENTIAL_IN_ENV
    ~/Library/Application Support/Claude/claude_desktop_config.json

VERIFIED (8)
  ✓ stripe-mcp
  ✓ github-mcp
  ✓ notion-mcp
  ...

Learn more: curatedmcp.com/certified
```

---

## Flags

| Flag | Meaning |
|------|---------|
| `--json` | Output raw JSON instead of formatted text |
| `--offline` | Skip catalog lookup (catalog won't be checked for verification status) |
| `--key <cmcp_...>` | Sync results to Auditor Pro — triggers email alert if new HIGH risks found |

Exit code is `1` if any HIGH-risk servers are found, `0` otherwise. Useful in CI.

### Auditor Pro sync

Set your license key once and every scan syncs automatically:

```bash
# Add to ~/.zshrc or ~/.bashrc
export CURATEDMCP_KEY=cmcp_your_key_here

# Then just run as normal — results sync silently
npx @curatedmcp/auditor
```

Or pass it inline:

```bash
npx @curatedmcp/auditor --key cmcp_your_key_here
```

Get a key at [curatedmcp.com/auditor#pro](https://curatedmcp.com/auditor#pro).

---

## Risk levels

| Level | Triggers |
|-------|----------|
| HIGH | Unverified + has FILE_SYSTEM_ACCESS or KEYCHAIN_ACCESS, or has CREDENTIAL_IN_ENV |
| MEDIUM | Unverified + has NETWORK_ACCESS |
| LOW | Unverified, no specific risk flags |
| VERIFIED | Found in the CuratedMCP verified catalog |

### Risk flags

- **FILE_SYSTEM_ACCESS** — command includes `--allow-write`, `--allow-read`, path args, or mentions filesystem
- **KEYCHAIN_ACCESS** — command invokes `keychain` or macOS `security` binary
- **CREDENTIAL_IN_ENV** — env block contains a key matching `SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE`
- **NETWORK_ACCESS** — command includes `--host`, `--port`, or mentions `localhost`/`http`
- **UNVERIFIED** — not in the CuratedMCP verified server catalog

---

## Config locations scanned

| Client | macOS | Windows |
|--------|-------|---------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` | `%APPDATA%\.cursor\mcp.json` |
| Claude Code | `~/.claude/mcp.json` + `.claude/mcp.json` (project) | same |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `%APPDATA%\Windsurf\mcp_config.json` |

---

## Build

### Prerequisites

- Node.js 18+
- npm 9+

### Steps

```bash
# Clone
git clone https://github.com/oneprofile-dev/mcp-auditor
cd mcp-auditor

# Install dependencies (chalk only + TypeScript tooling)
npm install

# Compile TypeScript → dist/
npm run build

# Run locally
node dist/cli.js

# Or via ts-node during development
npm run dev
```

The build output is in `dist/`. The entry point is `dist/cli.js`.

---

## Configure

The auditor fetches the verified server catalog from `https://www.curatedmcp.com/api/catalog` and caches it at `~/.curatedmcp/catalog.json` for 24 hours. No API key required.

To skip the catalog lookup (e.g. in a restricted network):

```bash
npx @curatedmcp/auditor --offline
```

No environment variables are needed to run the free auditor. Set `CURATEDMCP_KEY` to enable Pro sync.

---

## Deploy / Publish to npm

> These steps are for maintainers publishing a new version.

### One-time setup

```bash
# Log in to npm (needs publish rights to @curatedmcp org)
npm login

# Verify you're in the curatedmcp org
npm org ls curatedmcp
```

### Publishing a new version

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Build fresh
npm run build

# 3. Publish (public scoped package)
npm publish --access public
```

The package is published as `@curatedmcp/auditor`. After publishing, `npx @curatedmcp/auditor` will pick up the new version within a few minutes.

### Verifying the publish

```bash
# Check latest version on npm
npm view @curatedmcp/auditor version

# Test via npx (clears local cache)
npx --yes @curatedmcp/auditor@latest
```

---

## Development

```bash
# Run with ts-node (no build step needed)
npm run dev

# Run with JSON output
npm run dev -- --json

# Run offline (skip catalog fetch)
npm run dev -- --offline
```

---

## Architecture

```
src/
  cli.ts        Entry point — argument parsing, orchestration, exit code
  scanner.ts    Platform-aware config file discovery (macOS + Windows)
  risk.ts       Heuristic risk scoring — returns RiskFlag[] per server
  catalog.ts    Fetches + caches verified list from curatedmcp.com/api/catalog
  report.ts     Chalk terminal output + --json mode
  types.ts      Shared types: RiskFlag, RiskLevel, MCPServerEntry, AuditReport
```

**Dependencies:** `chalk` only. Everything else uses Node.js built-ins (`fs`, `os`, `path`, `https`, `crypto`). This keeps `npx` cold-start fast.

---

## License

MIT — see [LICENSE](LICENSE).

Questions? [curatedmcp.com/contact](https://curatedmcp.com/contact)
