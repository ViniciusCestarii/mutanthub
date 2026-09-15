import { EXPORT_COLUMNS, type ExportRow } from "./export-row";

/**
 * RFC 4180 CSV: fields containing separators, quotes or line breaks are
 * quoted, quotes are doubled, and rows end with CRLF. Multi-line fields such
 * as diffs and commands survive a round trip through spreadsheet software.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  // Neutralise formula injection in spreadsheet software. Only "=" and "@"
  // are prefixed: diffs and code legitimately start with "+" or "-", and a
  // quote prefix there would corrupt the dataset.
  const safe = /^[=@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(values: ReadonlyArray<unknown>): string {
  return `${values.map(csvEscape).join(",")}\r\n`;
}

export function csvHeader(): string {
  return csvLine(EXPORT_COLUMNS);
}

export function rowToCsv(row: ExportRow): string {
  return csvLine(EXPORT_COLUMNS.map((column) => row[column]));
}
