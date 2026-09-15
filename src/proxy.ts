import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers for every HTML response.
 *
 * Scripts: nonce + 'strict-dynamic'. Next.js applies the nonce to its own
 * inline/bootstrap scripts (read from the request CSP header); scripts they
 * load, including Monaco's AMD loader from jsDelivr and its blob: workers,
 * are trusted transitively. Styles allow 'unsafe-inline' because Monaco and
 * React style attributes inject inline styles that cannot carry a nonce.
 */
const isDev = process.env.NODE_ENV === "development";

function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    `connect-src 'self' https://cdn.jsdelivr.net${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Sign-in redirects to GitHub after a form submission; some browsers apply form-action to that.
    "form-action 'self' https://github.com",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      /* Everything except static assets and prefetches. */
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
