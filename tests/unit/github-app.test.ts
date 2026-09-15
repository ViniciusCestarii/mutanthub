import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });

const privatePem = pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString();

beforeEach(() => {
  process.env.GITHUB_APP_ID = "12345";
  process.env.GITHUB_APP_PRIVATE_KEY = privatePem;
  process.env.GITHUB_TOKEN = "";
  delete process.env.REDIS_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
});

describe("app JWT", () => {
  it("is an RS256 token signed by the app key with a short lifetime", async () => {
    const { createAppJwt } = await import("@/server/github/app-auth");
    const now = Date.UTC(2026, 8, 15, 12, 0, 0);
    const jwt = createAppJwt("12345", privatePem, now);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("12345");
    expect(claims.exp - claims.iat).toBe(10 * 60);
    expect(claims.iat).toBe(Math.floor(now / 1000) - 60);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(pair.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("accepts private keys with escaped newlines or base64 encoding", async () => {
    const { normalizePrivateKey } = await import("@/server/github/app-auth");
    expect(normalizePrivateKey(privatePem.replace(/\n/g, "\\n"))).toBe(privatePem.trim());
    expect(normalizePrivateKey(Buffer.from(privatePem).toString("base64"))).toBe(privatePem.trim());
  });
});

describe("webhook signatures", () => {
  it("verifies HMAC-SHA256 signatures and rejects tampering", async () => {
    const { verifyWebhookSignature } = await import("@/server/github/app-auth");
    const { createHmac } = await import("node:crypto");
    const body = '{"action":"created"}';
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(verifyWebhookSignature("s3cret", body, sig)).toBe(true);
    expect(verifyWebhookSignature("s3cret", body + " ", sig)).toBe(false);
    expect(verifyWebhookSignature("other", body, sig)).toBe(false);
    expect(verifyWebhookSignature("s3cret", body, null)).toBe(false);
    expect(verifyWebhookSignature("s3cret", body, "sha1=abc")).toBe(false);
  });
});

describe("token provider", () => {
  it("uses an installation token when the app is installed on the repository", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/repos/curl/curl/installation")) {
          return new Response(JSON.stringify({ id: 777 }), { status: 200 });
        }
        if (url.endsWith("/app/installations/777/access_tokens")) {
          return new Response(
            JSON.stringify({
              token: "ghs_installation",
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            }),
            { status: 201 },
          );
        }
        if (url.endsWith("/repos/nobody/nothing/installation")) {
          return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
        }
        return new Response("{}", { status: 500 });
      }),
    );
    const { createTokenProvider, clearAllInstallationCaches } =
      await import("@/server/github/app-auth");
    await clearAllInstallationCaches();
    const provider = createTokenProvider();

    expect(await provider.getToken("curl", "curl")).toBe("ghs_installation");
    expect(await provider.describe("curl", "curl")).toBe("app");
    // Second call is served from the caches: no new installation lookup or token mint.
    expect(await provider.getToken("curl", "curl")).toBe("ghs_installation");
    expect(calls.filter((c) => c.endsWith("/installation")).length).toBe(1);
    expect(calls.filter((c) => c.includes("access_tokens")).length).toBe(1);
    // The app JWT is used for the lookup, never a user token.
    expect(calls[0]).toMatch(/GET .*\/repos\/curl\/curl\/installation$/);

    // Repositories without an installation fall back to anonymous (no GITHUB_TOKEN here).
    expect(await provider.getToken("nobody", "nothing")).toBeUndefined();
    expect(await provider.describe("nobody", "nothing")).toBe("anonymous");
  });

  it("falls back to the personal token when the app lookup fails", async () => {
    process.env.GITHUB_TOKEN = "ghp_personal";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    const { createTokenProvider, clearAllInstallationCaches } =
      await import("@/server/github/app-auth");
    await clearAllInstallationCaches();
    const provider = createTokenProvider();
    expect(await provider.getToken("curl", "curl")).toBe("ghp_personal");
  });
});
