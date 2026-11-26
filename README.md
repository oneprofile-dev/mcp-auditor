# @curatedmcp/auditor

[![npm](https://img.shields.io/npm/v/@curatedmcp/auditor)](https://www.npmjs.com/package/@curatedmcp/auditor) [![Listed on PickAPlugin](https://pickaplugin.com/badge/curatedmcp.svg)](https://pickaplugin.com/p/curatedmcp)

Find every MCP (Model Context Protocol) server on your machine and flag the risky and known-bad ones. Works with Claude Code, Claude Desktop, Codex, Cursor, Windsurf, GitHub Copilot (VS Code) and Gemini CLI.

```
npx @curatedmcp/auditor
```

- **Fully local.** No account, no install. Your configs, commands, tool descriptions and secrets never leave the machine. The only network call is a read-only download of the CuratedMCP catalog (skip it with `--offline`).
- **Known-bad endpoints.** Flags servers on CuratedMCP's known-bad list, starting with the remote entries we found probing tools from the official MCP registry in November 2026.
- **Risky addresses, offline.** Cloud metadata addresses, wildcard-DNS hosts like `127.0.0.1.nip.io`, anonymous tunnels (ngrok, pinggy, trycloudflare), raw public IPs, and plain `http://` to remote hosts. Also checks URLs passed to `mcp-remote` and similar bridges.
- **Secrets in config files.** API keys in `env` blocks or pasted into HTTP headers.
- **Honest labels.** VERIFIED means a human Verified Review was done. LISTED means the server is in the CuratedMCP catalog. Matching is by npm or PyPI package or remote endpoint, never by the name you gave the server in your config.

Sharing a report is opt-in with `--share`; only server names, clients and flags are uploaded.

**[Auditor Pro](https://curatedmcp.com/auditor#pro) ($9/month):** weekly scans, an email when a new HIGH-risk or known-bad server appears on your machine, and scan history at [curatedmcp.com/dashboard/auditor](https://curatedmcp.com/dashboard/auditor).

---

## Example output

```
MCP Security Audit, 11/26/2026

Found 3 config files. 7 servers detected.

HIGH RISK (2)
  ⚠ helper: KNOWN_BAD, RISKY_ENDPOINT, NOT_IN_CATALOG
    ~/.cursor/mcp.json
    KNOWN BAD https://ngtpl-216-175-194-204.free.pinggy.net/m30/mcp
      Tunnel endpoint published by a registry account that also published cloud-metadata and internal-address entries. Source: Official MCP registry, io.github.zz959397ghb entries (reported Nov 24, 2026).

  ⚠ search: CREDENTIAL_IN_ENV, NOT_IN_CATALOG
    ~/Library/Application Support/Claude/claude_desktop_config.json
    npx -y some-search-mcp

NOT IN CATALOG (1): no risk flags, not reviewed by CuratedMCP
  ? my-local-tool

LISTED (3): in the CuratedMCP catalog, not yet Verified
  github, linear, notion

VERIFIED (1): passed a human Verified Review
  ✓ botsrated

Known-bad list updated 2026-11-26. Matching is by package or endpoint, never by the name in your config.
```

Exit code is `1` if any HIGH-risk server is found, so it works as a CI gate.

---

## Flags

| Flag | Meaning |
|------|---------|
| `--json` | Output raw JSON instead of formatted text |
| `--offline` | Skip catalog lookup (catalog won't be checked for verification status) |
| `--key <cmcp_...>` | Sync results to Auditor Pro: email alert if new HIGH risks are found |

Exit code is `1` if any HIGH-risk servers are found, `0` otherwise. Useful in CI.

### Auditor Pro sync

Set your license key once and every scan syncs automatically:

```bash
# Add to ~/.zshrc or ~/.bashrc
export CURATEDMCP_KEY=cmcp_your_key_here

# Then just run as normal; results sync silently
npx @curatedmcp/auditor
```

Or pass it inline:

```bash
npx @curatedmcp/auditor --key cmcp_your_key_here
```

Get a key at [curatedmcp.com/auditor#pro](https://curatedmcp.com/auditor#pro).

---

## Risk levels

| Level | Meaning |
|-------|---------|
| HIGH | On the known-bad list, or not in the catalog and has any risk flag |
| MEDIUM | In the catalog, but has a risk flag (for example a secret in its config) |
| LOW | Not in the catalog, no risk flags |
| LISTED | In the CuratedMCP catalog, not yet Verified |
| VERIFIED | Passed a human CuratedMCP Verified Review |

### Risk flags

- **KNOWN_BAD**: the endpoint or registry name is on CuratedMCP's known-bad list.
- **RISKY_ENDPOINT**: cloud metadata address, wildcard-DNS host, anonymous tunnel, raw public IP, plain http to a remote host, or credentials in the URL. Localhost and private addresses are not flagged.
- **FILE_SYSTEM_ACCESS**: command includes `--allow-write`, `--allow-read` or home/system paths.
- **KEYCHAIN_ACCESS**: command invokes `keychain`, macOS `security`, `secret-tool` or `kwallet`.
- **CREDENTIAL_IN_ENV**: a secret is stored in the config file. Either the env block has a key matching `SECRET|TOKEN|PASSWORD|KEY|AUTH|PRIVATE`, or an HTTP header such as `Authorization` or `X-API-Key` holds a literal value. Headers that only reference an environment variable (`Bearer ${API_KEY}`) are not flagged.
- **NETWORK_ACCESS**: a non-npx command that mentions `curl`, `wget`, `fetch` or `http`.
- **NOT_IN_CATALOG** (`UNVERIFIED` in JSON output): no CuratedMCP listing matches its package or endpoint.

---

## Config locations scanned

| Client | macOS | Linux | Windows |
|--------|-------|-------|---------|
| Claude Code | `~/.claude.json`, `~/.claude/mcp.json`, `.mcp.json` and `.claude/mcp.json` (project) | same | same |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| Codex (CLI and IDE extension) | `~/.codex/config.toml` (or `$CODEX_HOME`), `.codex/config.toml` (project) | same | same |
| Cursor | `~/.cursor/mcp.json`, `.cursor/mcp.json` (project) | same | `%USERPROFILE%\.cursor\mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | same | same |
| GitHub Copilot (VS Code) | `~/Library/Application Support/Code/User/mcp.json`, `.vscode/mcp.json` (project) | `~/.config/Code/User/mcp.json` | `%APPDATA%\Code\User\mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` | same | same |

--------|-------|---------|
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

# 2. Set the same version in CLI_VERSION in src/share.ts

# 3. Publish from main (public scoped package). prepublishOnly rebuilds dist/ first,
#    so a stale build can never ship under a new version number.
npm publish --access public
```

Publishing needs the `curatedmcp` npm account with two-factor authentication (or a granular token with publish rights).

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
  cli.ts        Entry point: argument parsing, orchestration, exit code
  scanner.ts    Platform-aware config file discovery (macOS + Windows)
  risk.ts       Risk scoring and catalog matching (by package or endpoint)
  catalog.ts    Fetches + caches the catalog (listed + verified) from curatedmcp.com/api/catalog
  endpoints.ts  Known-bad list and offline checks for risky remote addresses
  report.ts     Chalk terminal output + --json mode
  types.ts      Shared types: RiskFlag, RiskLevel, MCPServerEntry, AuditReport
```

**Dependencies:** `chalk` only. Everything else uses Node.js built-ins (`fs`, `os`, `path`, `https`, `crypto`). This keeps `npx` cold-start fast.

---

## License

MIT. See [LICENSE](LICENSE).

Questions? [curatedmcp.com/contact](https://curatedmcp.com/contact)
