import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GapReport } from "../../src/types.js";

export interface StoredReport {
  id: string;
  createdAt: string;
  sourceName: string;
  report: GapReport;
}

// Reports persist to plain JSON files under <repo root>/data/reports, next
// to the CLI's data/journey.csv. process.cwd() is this Next app's own
// directory (web/) when run via `next dev`/`next start` from there.
const REPORTS_DIR = path.join(process.cwd(), "..", "data", "reports");

function ensureDir(): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

export function saveReport(sourceName: string, report: GapReport): StoredReport {
  ensureDir();
  const stored: StoredReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    sourceName,
    report,
  };
  writeFileSync(path.join(REPORTS_DIR, `${stored.id}.json`), JSON.stringify(stored, null, 2));
  return stored;
}

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export function getReport(id: string): StoredReport | null {
  if (!VALID_ID.test(id)) return null;
  try {
    const raw = readFileSync(path.join(REPORTS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

export function listReports(): StoredReport[] {
  ensureDir();
  return readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(REPORTS_DIR, f), "utf-8")) as StoredReport)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
