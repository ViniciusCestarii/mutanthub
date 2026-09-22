"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/components/layout/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { defineMonacoThemes, monacoThemeFor } from "./monaco-theme";

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface MonacoDiffProps {
  original: string;
  modified: string;
  language?: string;
  height?: number | string;
  /** Render inline (single column) instead of side-by-side. */
  inline?: boolean;
  /** Let the reader drag the bottom edge to make the diff taller. */
  resizable?: boolean;
  className?: string;
}

/** Lazy-loaded Monaco diff editor for original vs mutated code. Always read-only. */
export function MonacoDiff({
  original,
  modified,
  language = "plaintext",
  height = 240,
  inline = false,
  resizable = false,
  className,
}: MonacoDiffProps) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      className={className}
      // `resize` needs a non-visible overflow; automaticLayout re-lays out Monaco as it changes.
      style={{ height, ...(resizable ? { resize: "vertical", overflow: "hidden" } : null) }}
      data-testid="monaco-diff"
    >
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={monacoThemeFor(resolvedTheme)}
        beforeMount={defineMonacoThemes}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
        options={{
          readOnly: true,
          originalEditable: false,
          renderSideBySide: !inline,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbersMinChars: 3,
          renderOverviewRuler: false,
          scrollbar: { alwaysConsumeMouseWheel: false },
          diffWordWrap: "off",
          automaticLayout: true,
        }}
      />
    </div>
  );
}
