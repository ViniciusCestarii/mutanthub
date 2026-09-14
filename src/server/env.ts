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
  get githubMode(): GitHubMode {
    const raw = (process.env.GITHUB_MODE ?? "auto").toLowerCase();
    if (raw === "live" || raw === "mock") return raw;
    return "auto";
  },
  /** Resolved mode: `auto` becomes `live` when a token is available. */
  get resolvedGithubMode(): "live" | "mock" {
    const mode = this.githubMode;
    if (mode !== "auto") return mode;
    return this.githubToken ? "live" : "mock";
  },
  get githubCacheTtlSeconds(): number {
    const n = Number(process.env.GITHUB_CACHE_TTL ?? "300");
    return Number.isFinite(n) && n > 0 ? n : 300;
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
