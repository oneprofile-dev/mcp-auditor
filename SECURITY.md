# Security Policy

## Reporting a vulnerability

Email **sam@curatedmcp.com** with the details (a proof-of-concept helps).
Please don't open a public issue for anything exploitable — give us a chance
to ship a fix first. You'll get an acknowledgement within 2 business days and
a status update at least weekly until it's resolved. We'll credit you in the
release notes unless you'd rather stay anonymous.

## Supported versions

Only the latest published version of `@curatedmcp/auditor` on npm receives
security fixes.

## What this software does and doesn't touch

- **100% local.** The auditor reads the MCP configuration files of the AI
  clients on your machine (Claude Code, Cursor, Windsurf, Copilot, Gemini),
  checks each configured server against CuratedMCP's risk-classified catalog,
  and prints an A–F grade — nothing about your machine, your configs, or the
  scan results is sent anywhere unless you explicitly pass `--share`, which
  uploads only server names and risk flags (never commands, env vars, or
  file paths) to generate a shareable report URL.
- **No account or API key required.**
- Exits non-zero on high-risk findings, so it's safe to drop into CI.

## Supply chain

- Published from this public repository — what's on npm is built from the
  source you can read here.
- `package-lock.json` is committed.
