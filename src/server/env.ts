import "server-only";

/**
 * Typed access to environment configuration. Reads lazily so tests can set
 * variables before importing modules that depend on them.
 */
export type GitHubMode = "auto" | "live" | "mock";

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? "";
  },
  get authSecret(): string | undefined {
    return process.env.AUTH_SECRET;
  },
  get githubClientId(): string | undefined {
    return process.env.AUTH_GITHUB_ID || undefined;
  },
  get githubClientSecret(): string | undefined {
    return process.env.AUTH_GITHUB_SECRET || undefined;
  },
  /** GitHub OAuth is configured when both id and secret are present. */
  get githubOAuthConfigured(): boolean {
    return Boolean(this.githubClientId && this.githubClientSecret);
  },
  /** The mocked login is on when explicitly requested, or when OAuth is missing outside production. */
  get mockAuthEnabled(): boolean {
    if (bool(process.env.AUTH_MOCK))
      return process.env.NODE_ENV !== "production" || bool(process.env.AUTH_MOCK_ALLOW_PRODUCTION);
    return !this.githubOAuthConfigured && process.env.NODE_ENV !== "production";
  },
  get githubToken(): string | undefined {
    return process.env.GITHUB_TOKEN || undefined;
  },
  // --- GitHub App (optional; raises rate limits and scopes access per installation) ---
  get githubAppId(): string | undefined {
    return process.env.GITHUB_APP_ID || undefined;
  },
  get githubAppPrivateKey(): string | undefined {
    const raw = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\n/g, "\n");
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) return decoded;
    } catch {
      /* not base64 */
    }
    return trimmed;
  },
  get githubAppSlug(): string | undefined {
    return process.env.GITHUB_APP_SLUG || undefined;
  },
  get githubAppWebhookSecret(): string | undefined {
    return process.env.GITHUB_APP_WEBHOOK_SECRET || undefined;
  },
  get githubAppConfigured(): boolean {
    return Boolean(this.githubAppId && this.githubAppPrivateKey);
  },
  get githubMode(): GitHubMode {
    const raw = (process.env.GITHUB_MODE ?? "auto").toLowerCase();
    if (raw === "live" || raw === "mock") return raw;
    return "auto";
  },
  /** Resolved mode: `auto` becomes `live` when a token is available. */
  get resolvedGithubMode(): "live" | "mock" {
    const mode = this.githubMode;
    if (mode !== "auto") return mode;
    return this.githubToken || this.githubAppConfigured ? "live" : "mock";
  },
  get githubCacheTtlSeconds(): number {
    const n = Number(process.env.GITHUB_CACHE_TTL ?? "300");
    return Number.isFinite(n) && n > 0 ? n : 300;
  },
  /** Optional shared Redis for rate limits and the GitHub cache (multi-instance deployments). */
  get redisUrl(): string | undefined {
    return process.env.REDIS_URL || undefined;
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
