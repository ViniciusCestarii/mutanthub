"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/layout/theme-provider";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { defineMonacoThemes, monacoThemeFor } from "./monaco-theme";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col gap-2 p-4" data-testid="code-viewer-loading">
      {Array.from({ length: 14 }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${40 + ((i * 37) % 55)}%` }} />
      ))}
    </div>
  ),
});

export interface CodeViewerProps {
  content: string;
  language: string;
  /** Number of mutants per 1-based line; drives the gutter indicators. */
  mutantCounts: Record<number, number>;
  selectedLine: number | null;
  /** Last line of the selection; defaults to `selectedLine`. */
  selectedEndLine?: number | null;
  onSelectLine: (line: number) => void;
  /** Reports a dragged line selection; start === end for a plain click. */
  onSelectRange?: (start: number, end: number) => void;
  onIndicatorClick?: (line: number) => void;
  /** Line to reveal when the editor first mounts. */
  initialLine?: number | null;
  /** Inclusive 1-based ranges to mark as changed (pull request mode). */
  changedRanges?: Array<[number, number]>;
  className?: string;
}

type IEditor = MonacoEditorNs.IStandaloneCodeEditor;

/**
 * Read-only Monaco viewer with mutant indicators in the glyph margin.
 * Clicking a line number or the code selects the line; clicking an indicator
 * reports the line so the parent can show the mutants attached to it.
 */
export function CodeViewer({
  content,
  language,
  mutantCounts,
  selectedLine,
  selectedEndLine,
  onSelectLine,
  onSelectRange,
  onIndicatorClick,
  initialLine,
  changedRanges,
  className,
}: CodeViewerProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<IEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<MonacoEditorNs.IEditorDecorationsCollection | null>(null);
  const callbacksRef = useRef({ onSelectLine, onSelectRange, onIndicatorClick });
  useEffect(() => {
    callbacksRef.current = { onSelectLine, onSelectRange, onIndicatorClick };
  }, [onSelectLine, onSelectRange, onIndicatorClick]);
  // Latest selection, readable from Monaco event handlers registered at mount.
  const selectedLineRef = useRef<number | null>(selectedLine);
  useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);
  // `onMount` is captured on the first render, when a line coming from the URL
  // hash is not known yet; the reveal below must read the current value.
  const initialLineRef = useRef<number | null>(initialLine ?? null);
  useEffect(() => {
    initialLineRef.current = initialLine ?? null;
  }, [initialLine]);

  const indicatorClickable = onIndicatorClick != null;

  const applyDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const decorations: MonacoEditorNs.IModelDeltaDecoration[] = [];
    for (const [start, end] of changedRanges ?? []) {
      decorations.push({
        range: new monaco.Range(start, 1, end, 1),
        options: {
          isWholeLine: true,
          className: "mh-line-changed",
          linesDecorationsClassName: "mh-changed-margin",
          hoverMessage: { value: "Changed in this pull request" },
        },
      });
    }
    for (const [lineStr, count] of Object.entries(mutantCounts)) {
      const line = Number(lineStr);
      if (!count || line < 1) continue;
      const bucket = count > 9 ? "many" : String(count);
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "mh-line-mutant",
          glyphMarginClassName: `mh-glyph-mutant mh-count-${bucket}${
            indicatorClickable ? " mh-glyph-clickable" : ""
          }`,
          glyphMarginHoverMessage: {
            value: `${count} mutant${count === 1 ? "" : "s"} on this line`,
          },
        },
      });
    }
    if (selectedLine) {
      decorations.push({
        range: new monaco.Range(selectedLine, 1, Math.max(selectedEndLine ?? 0, selectedLine), 1),
        options: {
          isWholeLine: true,
          className: "mh-line-selected",
          linesDecorationsClassName: "mh-line-selected",
        },
      });
    }
    if (!decorationsRef.current) decorationsRef.current = editor.createDecorationsCollection();
    decorationsRef.current.set(decorations);
  }, [mutantCounts, selectedLine, changedRanges, selectedEndLine, indicatorClickable]);

  useEffect(() => {
    applyDecorations();
  }, [applyDecorations]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // While the mouse is down a drag only records its range; it is reported
    // once on release, so a long drag does not re-render and navigate per move.
    let dragging = false;
    let pendingRange: [number, number] | null = null;
    editor.onMouseDown((e) => {
      dragging = true;
      pendingRange = null;
      window.addEventListener(
        "mouseup",
        () => {
          dragging = false;
          if (pendingRange) callbacksRef.current.onSelectRange?.(...pendingRange);
          pendingRange = null;
        },
        { once: true },
      );
      const line = e.target.position?.lineNumber;
      if (!line) return;
      const type = e.target.type;
      if (type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        callbacksRef.current.onIndicatorClick?.(line);
        callbacksRef.current.onSelectLine(line);
        return;
      }
      if (
        type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS ||
        type === monaco.editor.MouseTargetType.CONTENT_TEXT ||
        type === monaco.editor.MouseTargetType.CONTENT_EMPTY
      ) {
        callbacksRef.current.onSelectLine(line);
      }
    });
    // A drag ends on the line below the last selected one when it stops at column 1.
    editor.onDidChangeCursorSelection(({ selection, reason }) => {
      // only a real selection may change the range.
      if (reason === monaco.editor.CursorChangeReason.ContentFlush) return;
      const start = Math.min(selection.startLineNumber, selection.endLineNumber);
      const last = Math.max(selection.startLineNumber, selection.endLineNumber);
      if (last === start) {
        // A click: onMouseDown already selected the line.
        pendingRange = null;
        return;
      }
      const end = last > start && selection.endColumn === 1 ? last - 1 : last;
      if (dragging) pendingRange = [start, end];
      else callbacksRef.current.onSelectRange?.(start, end);
    });
    const target = initialLineRef.current ?? selectedLineRef.current;
    if (target) {
      editor.revealLineInCenter(target);
      editor.setPosition({ lineNumber: target, column: 1 });
    }
    // The first layout can arrive after mount (automaticLayout); re-reveal the
    // current selection once the editor has a real height, otherwise a line
    // selected before layout stays out of the rendered viewport.
    const layoutListener = editor.onDidLayoutChange((layout) => {
      if (layout.height <= 0) return;
      const line = selectedLineRef.current;
      if (line) editor.revealLineInCenterIfOutsideViewport(line);
      layoutListener.dispose();
    });
    applyDecorations();
  };

  // Reveal the selected line when it changes from outside (e.g. clicking a mutant in the side panel).
  useEffect(() => {
    if (selectedLine && editorRef.current) {
      editorRef.current.revealLineInCenterIfOutsideViewport(selectedLine);
    }
  }, [selectedLine]);

  return (
    <div className={className} data-testid="code-viewer">
      <Editor
        value={content}
        language={language}
        theme={monacoThemeFor(resolvedTheme)}
        beforeMount={defineMonacoThemes}
        onMount={handleMount}
        options={{
          readOnly: true,
          domReadOnly: true,
          glyphMargin: true,
          minimap: { enabled: false },
          lineNumbersMinChars: 4,
          fontSize: 12.5,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          folding: true,
          wordWrap: "off",
          automaticLayout: true,
          contextmenu: false,
          occurrencesHighlight: "off",
          selectionHighlight: false,
          scrollbar: { alwaysConsumeMouseWheel: false, verticalScrollbarSize: 10 },
          stickyScroll: { enabled: false },
        }}
      />
    </div>
  );
}
