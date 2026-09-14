"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Loader2 } from "lucide-react";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { TreeCache, TreeEntry } from "./types";

interface FileTreeProps {
  owner: string;
  repo: string;
  gitRef: string;
  currentPath: string;
  /** Preloaded entries for "" (root) and the ancestors of `currentPath`. */
  initialCache: TreeCache;
  onNavigate?: () => void;
}

interface DirState {
  loading: boolean;
  error: string | null;
}

function ancestorsOf(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

/**
 * Lazy file tree. Directories along the current path are expanded on first
 * render (their entries come from the server); other directories are fetched
 * from the tree API when expanded.
 */
export function FileTree({
  owner,
  repo,
  gitRef,
  currentPath,
  initialCache,
  onNavigate,
}: FileTreeProps) {
  const [cache, setCache] = useState<TreeCache>(initialCache);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const dirs = new Set<string>(ancestorsOf(currentPath));
    // If the current path is itself a directory (present in the cache), keep it open too.
    if (currentPath && initialCache[currentPath]) dirs.add(currentPath);
    return dirs;
  });
  const [dirState, setDirState] = useState<Record<string, DirState>>({});

  const load = useCallback(
    async (dirPath: string) => {
      setDirState((s) => ({ ...s, [dirPath]: { loading: true, error: null } }));
      try {
        const params = new URLSearchParams({ ref: gitRef, path: dirPath });
        const res = await fetch(`/api/projects/${owner}/${repo}/tree?${params}`);
        const body = (await res.json()) as { entries?: TreeEntry[]; error?: { message: string } };
        if (!res.ok || !body.entries)
          throw new Error(body.error?.message ?? "Failed to load directory");
        setCache((c) => ({ ...c, [dirPath]: body.entries ?? [] }));
        setDirState((s) => ({ ...s, [dirPath]: { loading: false, error: null } }));
      } catch (e) {
        setDirState((s) => ({
          ...s,
          [dirPath]: { loading: false, error: e instanceof Error ? e.message : "Failed to load" },
        }));
      }
    },
    [owner, repo, gitRef],
  );

  const toggle = (dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
    if (!cache[dirPath] && !dirState[dirPath]?.loading) void load(dirPath);
  };

  const renderEntries = (dirPath: string, depth: number): React.ReactNode => {
    const entries = cache[dirPath];
    const state = dirState[dirPath];
    if (!entries) {
      if (state?.error) {
        return (
          <li
            className="text-destructive px-2 py-1 text-xs"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {state.error}{" "}
            <button type="button" className="underline" onClick={() => void load(dirPath)}>
              retry
            </button>
          </li>
        );
      }
      return (
        <li
          className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-xs"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <Loader2 className="size-3 animate-spin" aria-hidden /> Loading…
        </li>
      );
    }
    if (entries.length === 0) {
      return (
        <li
          className="text-muted-foreground px-2 py-1 text-xs"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          Empty directory
        </li>
      );
    }
    return entries.map((entry) => {
      const isDir = entry.type === "dir";
      const isOpen = isDir && expanded.has(entry.path);
      const isCurrent = entry.path === currentPath;
      const isAncestor = isDir && currentPath.startsWith(`${entry.path}/`);
      const indent = { paddingLeft: 8 + depth * 12 };
      return (
        <li key={entry.path}>
          {isDir ? (
            <button
              type="button"
              onClick={() => toggle(entry.path)}
              aria-expanded={isOpen}
              className={cn(
                "hover:bg-muted flex w-full items-center gap-1 rounded-sm px-2 py-[3px] text-left text-xs",
                (isCurrent || isAncestor) && "text-foreground",
                isCurrent && "bg-muted font-medium",
              )}
              style={indent}
            >
              {isOpen ? (
                <ChevronDown className="text-muted-foreground size-3 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
              )}
              {isOpen ? (
                <FolderOpen
                  className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                  aria-hidden
                />
              ) : (
                <Folder className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
          ) : (
            <Link
              href={routes.projectCode(owner, repo, entry.path, { ref: gitRef })}
              onClick={onNavigate}
              aria-current={isCurrent ? "page" : undefined}
              data-testid={isCurrent ? "tree-current-file" : undefined}
              className={cn(
                "hover:bg-muted flex items-center gap-1 rounded-sm px-2 py-[3px] text-xs",
                isCurrent
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={{ paddingLeft: 8 + depth * 12 + 16 }}
            >
              <File className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{entry.name}</span>
            </Link>
          )}
          {isDir && isOpen ? <ul>{renderEntries(entry.path, depth + 1)}</ul> : null}
        </li>
      );
    });
  };

  return (
    <div className="font-mono" data-testid="file-tree">
      <ul>{renderEntries("", 0)}</ul>
    </div>
  );
}
