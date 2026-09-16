import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { env } from "@/server/env";

/** Auth.js session cookie names (secure prefix on HTTPS), possibly chunked as `.0`, `.1`, ... */
const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * The signed-in user's GitHub OAuth token for the current request, read from
 * the encrypted session cookie. Undefined for anonymous visitors, mocked
 * logins, and code that runs outside a request (jobs, webhooks).
 */
export const getSessionGitHubToken = cache(async (): Promise<string | undefined> => {
  const secret = env.authSecret;
  if (!secret) return undefined;
  let store: Awaited<ReturnType<typeof cookies>>;
  try {
    store = await cookies();
  } catch {
    return undefined;
  }
  for (const name of COOKIE_NAMES) {
    const value = readCookie(store, name);
    if (!value) continue;
    try {
      const token = await decode({ token: value, secret, salt: name });
      return token?.githubAccessToken || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
});

function readCookie(store: Awaited<ReturnType<typeof cookies>>, name: string): string | undefined {
  const whole = store.get(name)?.value;
  if (whole) return whole;
  const chunks: string[] = [];
  for (let i = 0; ; i += 1) {
    const chunk = store.get(`${name}.${i}`)?.value;
    if (!chunk) break;
    chunks.push(chunk);
  }
  return chunks.length ? chunks.join("") : undefined;
}
