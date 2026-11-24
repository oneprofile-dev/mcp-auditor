/**
 * Just enough TOML to read MCP servers out of a Codex config.toml, with no
 * dependencies. Reads [mcp_servers.<name>] and [mcp_servers.<name>.env] /
 * [mcp_servers.<name>.http_headers] tables whose values are strings, arrays of
 * strings, or inline tables of strings. Anything else is skipped, never thrown.
 */
type Table = Record<string, unknown>;

function parseString(src: string, i: number): [string, number] | null {
  const q = src[i];
  if (q !== '"' && q !== "'") return null;
  let out = "";
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (q === '"' && src[j] === "\\" && j + 1 < src.length) {
      const c = src[j + 1];
      out += c === "n" ? "\n" : c === "t" ? "\t" : c;
      j += 2;
      continue;
    }
    out += src[j++];
  }
  return j < src.length ? [out, j + 1] : null;
}

function skipWs(src: string, i: number): number {
  while (i < src.length && /[\s,]/.test(src[i])) i++;
  return i;
}

// value := string | [string, ...] | { key = string, ... } ; returns [value, nextIndex]
function parseValue(src: string, i: number): [unknown, number] | null {
  i = skipWs(src, i);
  const str = parseString(src, i);
  if (str) return str;
  if (src[i] === "[") {
    const arr: unknown[] = [];
    i++;
    for (;;) {
      i = skipWs(src, i);
      if (src[i] === "]") return [arr, i + 1];
      const v = parseValue(src, i);
      if (!v) return null;
      arr.push(v[0]);
      i = v[1];
    }
  }
  if (src[i] === "{") {
    const obj: Table = {};
    i++;
    for (;;) {
      i = skipWs(src, i);
      if (src[i] === "}") return [obj, i + 1];
      const kv = parseKey(src, i);
      if (!kv) return null;
      i = skipWs(src, kv[1]);
      if (src[i] !== "=") return null;
      const v = parseValue(src, i + 1);
      if (!v) return null;
      obj[kv[0]] = v[0];
      i = v[1];
    }
  }
  // number / boolean / date: read to end of token, keep as raw text
  const m = /^[^\s,\]}#]+/.exec(src.slice(i));
  return m ? [m[0], i + m[0].length] : null;
}

function parseKey(src: string, i: number): [string, number] | null {
  const str = parseString(src, i);
  if (str) return str;
  const m = /^[A-Za-z0-9_-]+/.exec(src.slice(i));
  return m ? [m[0], i + m[0].length] : null;
}

function splitDotted(header: string): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < header.length) {
    i = skipWs(header, i);
    const k = parseKey(header, i);
    if (!k) break;
    parts.push(k[0]);
    i = skipWs(header, k[1]);
    if (header[i] === ".") i++;
  }
  return parts;
}

function stripComment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === "\\" && q === '"') i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#") return line.slice(0, i);
  }
  return line;
}

/** Returns { serverName: { command, args, env, url, http_headers, ... } }. */
export function parseCodexToml(raw: string): Record<string, Table> {
  const servers: Record<string, Table> = {};
  let target: Table | null = null;
  // Join multi-line arrays / inline tables: accumulate until brackets balance.
  let pending = "";
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!pending && line.startsWith("[")) {
      const header = /^\[\s*([^\[\]]+?)\s*\]$/.exec(line);
      target = null;
      if (!header) continue; // [[array tables]] are not used for MCP servers
      const parts = splitDotted(header[1]);
      if (parts[0] !== "mcp_servers" || parts.length < 2) continue;
      const name = parts[1];
      servers[name] ??= {};
      if (parts.length === 2) target = servers[name];
      else if (parts.length === 3) {
        const sub = (servers[name][parts[2]] ??= {}) as Table;
        target = sub;
      }
      continue;
    }
    if (!target) continue;
    pending = pending ? pending + "\n" + line : line;
    const opens = (pending.match(/[\[{]/g) ?? []).length;
    const closes = (pending.match(/[\]}]/g) ?? []).length;
    if (opens > closes) continue;
    const stmt = pending;
    pending = "";
    const k = parseKey(stmt, 0);
    if (!k) continue;
    const eq = skipWs(stmt, k[1]);
    if (stmt[eq] !== "=") continue;
    const v = parseValue(stmt, eq + 1);
    if (v) target[k[0]] = v[0];
  }
  return servers;
}
