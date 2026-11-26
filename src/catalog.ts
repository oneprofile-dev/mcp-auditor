import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as https from "https";
import { normalizeEndpoint } from "./endpoints.js";

const CATALOG_URL = "https://www.curatedmcp.com/api/catalog";
const CACHE_DIR = path.join(os.homedir(), ".curatedmcp");
// v2: entries carry `verified` and `url`. A new file so a 1.4 cache (no
// verified field) is never read as "everything is listed only".
const CACHE_FILE = path.join(CACHE_DIR, "catalog-v2.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CatalogEntry {
  slug: string;
  name: string;
  npm?: string;
  pypi?: string;
  url?: string;
  /** true only when a human Verified Review was completed. */
  verified?: boolean;
}

export type CatalogStatus = "VERIFIED" | "LISTED";

export interface CatalogMatch {
  status: CatalogStatus;
  slug: string;
}

/**
 * Lookup by what actually runs (npm package, PyPI package, remote endpoint),
 * never by the name a user typed in their own config: a config entry called
 * "github" proves nothing about what it launches.
 */
export interface Catalog {
  byNpm: Map<string, CatalogMatch>;
  byPypi: Map<string, CatalogMatch>;
  byUrl: Map<string, CatalogMatch>;
  size: number;
}

interface CachedCatalog {
  fetchedAt: number;
  servers: CatalogEntry[];
}

export const EMPTY_CATALOG: Catalog = { byNpm: new Map(), byPypi: new Map(), byUrl: new Map(), size: 0 };

function readCache(): CachedCatalog | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CachedCatalog;
  } catch {
    return null;
  }
}

function writeCache(data: CachedCatalog): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf-8");
  } catch {
    // Cache write failure is non-fatal
  }
}

function fetchCatalog(): Promise<CatalogEntry[]> {
  return new Promise((resolve) => {
    const req = https.get(CATALOG_URL, { timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve(Array.isArray(json.servers) ? json.servers : []);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
  });
}

export async function getCatalog(): Promise<Catalog> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return buildCatalog(cached.servers);
  }

  const servers = await fetchCatalog();
  if (servers.length > 0) {
    writeCache({ fetchedAt: Date.now(), servers });
    return buildCatalog(servers);
  }

  // Fall back to stale cache if fetch failed
  if (cached) return buildCatalog(cached.servers);
  return EMPTY_CATALOG;
}

export function buildCatalog(servers: CatalogEntry[]): Catalog {
  const cat: Catalog = { byNpm: new Map(), byPypi: new Map(), byUrl: new Map(), size: servers.length };
  for (const s of servers) {
    const match: CatalogMatch = { status: s.verified === true ? "VERIFIED" : "LISTED", slug: s.slug };
    if (s.npm) cat.byNpm.set(s.npm.toLowerCase(), match);
    if (s.pypi) cat.byPypi.set(s.pypi.toLowerCase(), match);
    const url = s.url ? normalizeEndpoint(s.url) : null;
    if (url) cat.byUrl.set(url, match);
  }
  return cat;
}
