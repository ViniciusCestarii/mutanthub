/**
 * Only same-origin, path-style targets are accepted for post-login redirects.
 * Anything else (absolute URLs, protocol-relative "//evil", javascript:) falls
 * back to the given default, which prevents open redirects.
 */
export function safeRelativePath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return fallback;
  }
  return value;
}
