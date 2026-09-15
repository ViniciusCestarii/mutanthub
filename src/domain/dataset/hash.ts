import { createHash } from "node:crypto";
import type { ExportRow } from "./export-row";

/** Canonical JSON: keys in a fixed order so the hash is stable across runs. */
export function canonicalRow(row: ExportRow): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(row).sort()) ordered[key] = row[key as keyof ExportRow];
  return JSON.stringify(ordered);
}

/** SHA-256 over the canonical rows, one per line, in id order. */
export function hashRows(rows: ReadonlyArray<ExportRow>): string {
  const hash = createHash("sha256");
  for (const row of [...rows].sort((a, b) => a.id - b.id)) hash.update(`${canonicalRow(row)}\n`);
  return hash.digest("hex");
}

/** URL-safe identifier derived from a snapshot name plus a date. */
export function snapshotSlug(name: string, date: Date): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const stamp = date.toISOString().slice(0, 10);
  return `${base || "snapshot"}-${stamp}`;
}
