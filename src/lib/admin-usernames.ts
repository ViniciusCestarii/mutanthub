/**
 * Parses ADMIN_GITHUB_USERNAMES ("alice, Bob,carol") into normalised GitHub
 * usernames. Users in this list are promoted to the global ADMIN role when
 * they sign in, which bootstraps the first administrator without database access.
 */
export function parseAdminUsernames(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((name) => name.trim().replace(/^@/, "").toLowerCase())
      .filter((name) => /^[a-z0-9-]{1,39}$/.test(name)),
  );
}

export function isBootstrapAdmin(username: string, raw: string | undefined): boolean {
  return parseAdminUsernames(raw).has(username.toLowerCase());
}
