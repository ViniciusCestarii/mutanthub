interface EditorStatusBarProps {
  path: string;
  lineCount: number;
  language: string;
  size: number;
  selectedLine: number | null;
  mutantCount: number;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

/** Thin VS Code-like status bar under the editor. */
export function EditorStatusBar({
  path,
  lineCount,
  language,
  size,
  selectedLine,
  mutantCount,
}: EditorStatusBarProps) {
  return (
    <div
      className="border-border bg-muted/40 text-muted-foreground flex h-6 shrink-0 items-center gap-3 border-t px-3 font-mono text-[11px]"
      data-testid="editor-status-bar"
    >
      <span className="truncate">{path}</span>
      <span className="ml-auto shrink-0">{lineCount} lines</span>
      <span className="shrink-0">{formatSize(size)}</span>
      <span className="shrink-0">{language}</span>
      <span className="shrink-0">
        {mutantCount} mutant{mutantCount === 1 ? "" : "s"}
      </span>
      <span className="text-foreground shrink-0" data-testid="status-selected-line">
        {selectedLine ? `L${selectedLine}` : "no selection"}
      </span>
    </div>
  );
}
