# Contributing to @curatedmcp/auditor

Thanks for your interest in contributing! This is a local-first security
scanner — contributions that keep it fast, accurate, and 100% local are most
welcome.

## Getting started

```bash
git clone https://github.com/oneprofile-dev/mcp-auditor.git
cd mcp-auditor
npm install
npm run build
```

## Development workflow

```bash
npm run dev              # ts-node src/cli.ts — fast iteration
npm run build             # compile TypeScript → dist/
npm start                 # run the built CLI (node dist/cli.js)
node dist/cli.js --share  # test the shareable-report flow
```

## What we accept

- Bug fixes with a clear repro case, especially config-detection edge cases
  across different AI clients (Claude Code, Cursor, Windsurf, Copilot,
  Gemini)
- New risk checks added to the risk-classified catalog logic, with a clear
  rationale
- Improved CLI output / grading clarity
- Tests (the project doesn't have a suite yet — a first one is welcome)

## What we don't accept (yet)

- Anything that sends scan data off the machine by default — the entire
  value proposition is "100% local unless you pass `--share`," and
  `--share` itself must only ever upload server names and risk flags, never
  commands, env vars, or file paths
- New runtime dependencies beyond what's already there (keep the dep tree
  minimal — this ships via `npx`, so install-time weight matters)

## Pull request checklist

- [ ] `npm run build` passes
- [ ] Ran the CLI against a real machine with at least one configured MCP
      client and confirmed the grade/output looks correct
- [ ] Description explains the *why*, not just the what

## License

MIT — your contributions will be released under the same license.
