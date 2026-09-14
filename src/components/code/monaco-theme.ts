"use client";

import type { Monaco } from "@monaco-editor/react";

let defined = false;

/** Registers editor themes that follow the app palette (light & dark). */
export function defineMonacoThemes(monaco: Monaco) {
  if (defined) return;
  defined = true;
  monaco.editor.defineTheme("mutanthub-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorLineNumber.foreground": "#9ca3af",
      "editorLineNumber.activeForeground": "#111827",
      "editor.lineHighlightBackground": "#f3f4f6",
      "editorGutter.background": "#ffffff",
    },
  });
  monaco.editor.defineTheme("mutanthub-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0a0a0a",
      "editorLineNumber.foreground": "#525252",
      "editorLineNumber.activeForeground": "#e5e5e5",
      "editor.lineHighlightBackground": "#171717",
      "editorGutter.background": "#0a0a0a",
    },
  });
}

export function monacoThemeFor(resolvedTheme: string | undefined): string {
  return resolvedTheme === "dark" ? "mutanthub-dark" : "mutanthub-light";
}
