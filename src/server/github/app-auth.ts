import "server-only";
import { createHmac, createSign, timingSafeEqual, createHash } from "node:crypto";
import { env } from "@/server/env";
import { getCacheStore } from "@/server/infra/cache-store";
import { GitHubError } from "./types";

/**
 * GitHub App authentication without extra dependencies.
 *
 * - An app JWT (RS256, 10 minutes) signed with the app's private key
 *   identifies the app itself and is used to look up installations.
 * - An installation access token (1 hour) is minted per installation and used
 *   for repository reads. Tokens are cached in process memory only; the
 *   installation id per repository is cached in the shared cache store.
 * - Repositories without an installation fall back to GITHUB_TOKEN, then to
 *   anonymous requests, so browsing never breaks when the app is not installed.
 */

export type GitHubAuthSource = "app" | "token" | "anonymous";

export interface GitHubTokenProvider {
  /** Token to use for a request touching `owner/repo`, or undefined for anonymous. */
  getToken(owner: string, repo: string): Promise<string | undefined>;
  /** Which server-side credential a request for this repository would use (ignores user tokens). */
  describe(owner: string, repo: string): Promise<GitHubAuthSource>;
  /** True when `token` belongs to the signed-in user of the current request. */
  isUserToken(token: string): Promise<boolean>;
  /**
   * GitHub rejected `token` (401). Returns the next credential to try when the
   * rejected one was a user token (which is then ignored for a while), or
   * null when there is nothing else to try.
   */
  fallbackFor(
    token: string,
    owner: string,
    repo: string,
  ): Promise<{ token: string | undefined } | null>;
}

/** Resolves the signed-in user's GitHub token for the current request, if any. */
export type UserTokenSource = () => Promise<string | undefined>;

/** User tokens GitHub rejected, so one revoked token does not cost a request per read. */
const rejectedUserTokens = new Set<string>();
const MAX_REJECTED = 1000;
const REJECTED_TTL_MS = 60 * 60 * 1000;
const rejectedAt = new Map<string, number>();

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isRejected(token: string): boolean {
  const key = fingerprint(token);
  const at = rejectedAt.get(key);
  if (at == null) return false;
  if (Date.now() - at > REJECTED_TTL_MS) {
    rejectedUserTokens.delete(key);
    rejectedAt.delete(key);
    return false;
  }
  return true;
}

function reject(token: string): void {
  if (rejectedUserTokens.size >= MAX_REJECTED) {
    rejectedUserTokens.clear();
    rejectedAt.clear();
  }
  const key = fingerprint(token);
  rejectedUserTokens.add(key);
  rejectedAt.set(key, Date.now());
}

/** Test hook. */
export function clearRejectedUserTokens(): void {
  rejectedUserTokens.clear();
  rejectedAt.clear();
}

const API_BASE = "https://api.github.com";
const INSTALLATION_CACHE_TTL_MS = 10 * 60 * 1000;
const NO_INSTALLATION = -1;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Normalises a PEM that arrived through an env var (escaped newlines or base64). */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\n/g, "\n").trim();
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) return decoded.trim();
  } catch {
    /* not base64 */
  }
  return trimmed;
}

/** RS256 JWT for the GitHub App (issued 60 s in the past to tolerate clock skew). */
export function createAppJwt(appId: string, privateKeyPem: string, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKeyPem).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Constant-time check of the `X-Hub-Signature-256` header. */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function githubAppInstallUrl(target?: { owner: string }): string | null {
  const slug = env.githubAppSlug;
  if (!slug) return null;
  const base = `https://github.com/apps/${slug}/installations/new`;
  return target
    ? `${base}/permissions?target_id=&suggested_target=${encodeURIComponent(target.owner)}`
    : base;
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<number, CachedToken>();
const tokenInFlight = new Map<number, Promise<string>>();

async function githubJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MutantHub",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new GitHubError("NETWORK", `Could not reach GitHub: ${reason}`);
  }
  if (response.status === 404) throw new GitHubError("NOT_FOUND", "Not found");
  if (response.status === 401)
    throw new GitHubError("UNAUTHORIZED", "GitHub App credentials were rejected");
  if (!response.ok) {
    throw new GitHubError(
      response.status >= 500 ? "UNAVAILABLE" : "UNAUTHORIZED",
      `GitHub App request failed with ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

function installationCacheKey(owner: string, repo: string): string {
  return `installation:${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/** Installation id covering the repository, or null when the app is not installed there. */
export async function findInstallationId(owner: string, repo: string): Promise<number | null> {
  if (!env.githubAppConfigured) return null;
  const store = getCacheStore("github-app");
  const key = installationCacheKey(owner, repo);
  const cached = await store.get<number>(key);
  if (cached !== undefined) return cached === NO_INSTALLATION ? null : cached;

  const jwt = createAppJwt(env.githubAppId!, env.githubAppPrivateKey!);
  let id: number | null;
  try {
    const data = await githubJson<{ id: number }>(
      `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`,
      jwt,
    );
    id = data.id;
  } catch (error) {
    if (error instanceof GitHubError && error.kind === "NOT_FOUND") id = null;
    else throw error;
  }
  await store.set(key, id ?? NO_INSTALLATION, INSTALLATION_CACHE_TTL_MS);
  return id;
}

/** Drops cached installation lookups (called by the webhook on installation changes). */
export async function invalidateInstallationCache(repos: Array<{ owner: string; repo: string }>) {
  const store = getCacheStore("github-app");
  await Promise.all(repos.map((r) => store.delete(installationCacheKey(r.owner, r.repo))));
}

export async function clearAllInstallationCaches(): Promise<void> {
  await getCacheStore("github-app").clear();
  tokenCache.clear();
}

/** Mints (or reuses) an installation access token; refreshed a minute before expiry. */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const pending = tokenInFlight.get(installationId);
  if (pending) return pending;

  const promise = (async () => {
    const jwt = createAppJwt(env.githubAppId!, env.githubAppPrivateKey!);
    const data = await githubJson<InstallationTokenResponse>(
      `${API_BASE}/app/installations/${installationId}/access_tokens`,
      jwt,
      {
        method: "POST",
        body: JSON.stringify({ permissions: { contents: "read", metadata: "read" } }),
      },
    );
    tokenCache.set(installationId, { token: data.token, expiresAt: Date.parse(data.expires_at) });
    return data.token;
  })().finally(() => tokenInFlight.delete(installationId));
  tokenInFlight.set(installationId, promise);
  return promise;
}

/**
 * Chooses the credential per request and repository: the signed-in user's
 * OAuth token (their own 5,000 requests per hour), then the app installation
 * token, then the deployment's personal token, then anonymous.
 */
export function createTokenProvider(userToken?: UserTokenSource): GitHubTokenProvider {
  async function currentUserToken(): Promise<string | undefined> {
    if (!userToken) return undefined;
    try {
      const token = await userToken();
      return token && !isRejected(token) ? token : undefined;
    } catch {
      return undefined;
    }
  }
  async function serverToken(owner: string, repo: string): Promise<string | undefined> {
    if (env.githubAppConfigured) {
      try {
        const installationId = await findInstallationId(owner, repo);
        if (installationId) return await getInstallationToken(installationId);
      } catch (error) {
        console.error("[github-app] falling back to token auth:", (error as Error).message);
      }
    }
    return env.githubToken;
  }

  return {
    async getToken(owner, repo) {
      return (await currentUserToken()) ?? serverToken(owner, repo);
    },
    async isUserToken(token) {
      if (!userToken) return false;
      try {
        return (await userToken()) === token;
      } catch {
        return false;
      }
    },
    async fallbackFor(token, owner, repo) {
      if (!(await this.isUserToken(token))) return null;
      reject(token);
      console.warn("[github] a user's OAuth token was rejected; using server credentials");
      return { token: await serverToken(owner, repo) };
    },
    async describe(owner, repo) {
      if (env.githubAppConfigured) {
        try {
          if (await findInstallationId(owner, repo)) return "app";
        } catch {
          /* fall through */
        }
      }
      return env.githubToken ? "token" : "anonymous";
    },
  };
}
