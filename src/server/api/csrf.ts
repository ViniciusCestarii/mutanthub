import "server-only";

/**
 * CSRF check for the upload endpoint (route handlers do not get Next.js's
 * server-action origin check). The browser's Origin must match one of the
 * hosts the app is reachable at: the Host header, X-Forwarded-Host set by a
 * reverse proxy, the request URL, or the configured public AUTH_URL.
 */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const candidates = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    safeHost(request.url),
    safeHost(process.env.AUTH_URL),
  ];
  return candidates.some(
    (value) =>
      value
        ?.split(",")
        .map((h) => h.trim().toLowerCase())
        .includes(originHost) ?? false,
  );
}

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
