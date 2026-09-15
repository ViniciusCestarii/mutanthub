import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SECRET = "whsec_test";

beforeAll(() => {
  process.env.GITHUB_APP_WEBHOOK_SECRET = SECRET;
  delete process.env.REDIS_URL;
});

afterAll(() => {
  delete process.env.GITHUB_APP_WEBHOOK_SECRET;
});

function signed(body: string, event: string, secret = SECRET): Request {
  return new Request("http://localhost/api/github/webhook", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
  });
}

describe("POST /api/github/webhook", () => {
  it("rejects payloads with a bad signature", async () => {
    const { POST } = await import("@/app/api/github/webhook/route");
    const res = await POST(signed('{"zen":"x"}', "ping", "wrong-secret"));
    expect(res.status).toBe(401);
    const missing = await POST(
      new Request("http://localhost/api/github/webhook", { method: "POST", body: "{}" }),
    );
    expect(missing.status).toBe(401);
  });

  it("answers pings and ignores unrelated events", async () => {
    const { POST } = await import("@/app/api/github/webhook/route");
    expect((await (await POST(signed('{"zen":"x"}', "ping"))).json()).pong).toBe(true);
    const res = await POST(signed('{"action":"opened"}', "pull_request"));
    expect((await res.json()).ignored).toBe("pull_request");
  });

  it("invalidates cached installation lookups for the affected repositories", async () => {
    const { POST } = await import("@/app/api/github/webhook/route");
    const body = JSON.stringify({
      action: "added",
      installation: { id: 42, account: { login: "curl" } },
      repositories_added: [{ full_name: "curl/curl" }, { full_name: "curl/curl-www" }],
      repositories_removed: [{ full_name: "broken" }],
    });
    const res = await POST(signed(body, "installation_repositories"));
    expect(res.status).toBe(200);
    expect((await res.json()).invalidated).toBe(2);
  });

  it("refuses to run without a configured secret", async () => {
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/github/webhook/route");
    expect((await POST(signed("{}", "ping"))).status).toBe(503);
    process.env.GITHUB_APP_WEBHOOK_SECRET = SECRET;
  });
});
