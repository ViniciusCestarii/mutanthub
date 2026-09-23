"use client";

import { THEME_BOOTSTRAP_SCRIPT } from "./theme-script";

/**
 * Runs the theme bootstrap during HTML parsing. On client renders (e.g. a root
 * layout remount after a server action redirect) it renders as inert
 * `text/plain`, so React does not warn about script tags; ThemeProvider
 * re-applies the theme in that case.
 */
export function ThemeBootstrap({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
    />
  );
}
