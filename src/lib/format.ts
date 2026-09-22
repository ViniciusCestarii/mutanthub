import { formatDistanceToNowStrict, format } from "date-fns";

export function shortSha(sha: string, length = 7): string {
  return sha.slice(0, length);
}

/** "120" for one line, "120–124" for a block; with prefix "L", "L120–L124". */
export function lineRangeLabel(start: number, end: number, prefix = ""): string {
  return end > start ? `${prefix}${start}–${prefix}${end}` : `${prefix}${start}`;
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function absoluteDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function absoluteDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy HH:mm");
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${hours}h ${m}m` : `${hours}h`;
}

export function fileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function projectSlug(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
