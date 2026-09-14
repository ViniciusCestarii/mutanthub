"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bug, ExternalLink, FileWarning, FolderTree, GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CodeViewer } from "@/components/code/code-viewer";
import { languageForPath } from "@/components/code/language";
import { EmptyState } from "@/components/shared/empty-state";
import { SuggestMutantDrawer } from "@/components/mutants/suggest-mutant-drawer";
import { routes } from "@/lib/routes";
import { shortSha } from "@/lib/format";
import { Breadcrumbs } from "./breadcrumbs";
import { CommitSelector } from "./commit-selector";
import { DirectoryListing } from "./directory-listing";
import { EditorStatusBar } from "./editor-status-bar";
import { FileTree } from "./file-tree";
import { MutantsPanel } from "./mutants-panel";
import type {
  BrowserCommit,
  BrowserProject,
  BrowserRevision,
  BrowserTarget,
  TreeCache,
} from "./types";

export interface CodeWorkspaceProps {
  project: BrowserProject;
  commit: BrowserCommit;
  /** The ref as written in the URL (branch name or SHA). */
  gitRef: string;
  path: string;
  target: BrowserTarget;
  treeCache: TreeCache;
  revisions: BrowserRevision[];
  signedIn: boolean;
}

function lineFromHash(hash: string): number | null {
  const match = hash.match(/^#L(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * The selected line is React state mirrored into the URL hash (#L123) so links
 * are shareable. State (not the hash) is the source of truth: a router refresh
 * after a submission must not drop the selection or close the drawer.
 */
function useSelectedLine(): [number | null, (line: number) => void] {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setSelectedLine(lineFromHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const selectLine = useCallback((line: number) => {
    setSelectedLine(line);
    const url = `${window.location.pathname}${window.location.search}#L${line}`;
    if (window.location.hash !== `#L${line}`)
      window.history.replaceState(window.history.state, "", url);
  }, []);

  return [selectedLine, selectLine];
}

/**
 * Client shell of the IDE-like browser: owns line selection, drawer state and
 * the mobile sheets. All data arrives pre-fetched from the server page.
 */
export function CodeWorkspace({
  project,
  commit,
  gitRef,
  path,
  target,
  treeCache,
  revisions,
  signedIn,
}: CodeWorkspaceProps) {
  const [selectedLine, selectLine] = useSelectedLine();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [mutantsPanelOpen, setMutantsPanelOpen] = useState(false);

  const file = target.kind === "file" ? target.file : null;
  const content = file?.content ?? null;
  const lines = useMemo(
    () => (content ? content.replace(/\r\n?/g, "\n").split("\n") : []),
    [content],
  );
  const language = languageForPath(path);

  const mutantCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const m of file?.mutants ?? []) {
      for (let l = m.startLine; l <= m.endLine; l++) counts[l] = (counts[l] ?? 0) + 1;
    }
    return counts;
  }, [file?.mutants]);

  const currentUrl = routes.projectCode(project.owner, project.repo, path || undefined, {
    ref: gitRef,
    line: selectedLine ?? undefined,
  });
  const selectedLineText = selectedLine && lines.length ? (lines[selectedLine - 1] ?? "") : null;

  const treeNode = (onNavigate?: () => void) => (
    <FileTree
      owner={project.owner}
      repo={project.repo}
      gitRef={gitRef}
      currentPath={path}
      initialCache={treeCache}
      onNavigate={onNavigate}
    />
  );

  const panelNode = file ? (
    <MutantsPanel
      owner={project.owner}
      repo={project.repo}
      filePath={file.path}
      mutants={file.mutants}
      mutantsAtOtherRevisions={file.mutantsAtOtherRevisions}
      selectedLine={selectedLine}
      selectedLineText={selectedLineText}
      onSelectLine={(line) => {
        selectLine(line);
        setMutantsPanelOpen(false);
      }}
      onSuggest={() => {
        setMutantsPanelOpen(false);
        setDrawerOpen(true);
      }}
      signedIn={signedIn}
      signInHref={routes.signIn(currentUrl)}
    />
  ) : (
    <div className="text-muted-foreground p-3 text-xs">Open a file to see its mutants.</div>
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col" data-testid="code-workspace">
      {/* Top strip */}
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setTreeOpen(true)}
          aria-label="Open file tree"
        >
          <FolderTree className="size-3.5" aria-hidden /> Files
        </Button>
        <Breadcrumbs owner={project.owner} repo={project.repo} path={path} gitRef={gitRef} />
        <div className="ml-auto flex items-center gap-2">
          <CommitSelector
            owner={project.owner}
            repo={project.repo}
            path={path}
            defaultBranch={project.defaultBranch}
            commit={commit}
            revisions={revisions}
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hidden sm:inline-flex"
          >
            <a
              href={routes.github.commit(project.owner, project.repo, commit.sha)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <GitCommitHorizontal className="size-3.5" aria-hidden /> View commit on GitHub
            </a>
          </Button>
          {file ? (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <a
                href={routes.github.file(
                  project.owner,
                  project.repo,
                  commit.sha,
                  file.path,
                  selectedLine ?? undefined,
                )}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="size-3.5" aria-hidden />{" "}
                <span className="hidden sm:inline">View file on GitHub</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="border-border bg-muted/30 text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1 text-[11px]">
        <span>
          Browsing commit <span className="text-foreground font-mono">{shortSha(commit.sha)}</span>
          {commit.message ? (
            <span className="hidden sm:inline">
              {" "}
              · {commit.message.split("\n")[0].slice(0, 80)}
            </span>
          ) : null}
        </span>
        {!commit.isHead ? (
          <span
            className="ml-auto rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-amber-700 dark:text-amber-300"
            data-testid="older-revision-notice"
          >
            Older revision — mutants shown were created against this exact commit.
          </span>
        ) : null}
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        <aside
          className="border-border hidden w-64 shrink-0 overflow-y-auto border-r py-2 md:block"
          aria-label="Files"
        >
          {treeNode()}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col" aria-label="Code">
          {target.kind === "dir" ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DirectoryListing
                owner={project.owner}
                repo={project.repo}
                gitRef={gitRef}
                path={path}
                entries={target.dir.entries}
              />
            </div>
          ) : file && file.content != null ? (
            <>
              <CodeViewer
                className="min-h-0 flex-1"
                content={file.content}
                language={language}
                mutantCounts={mutantCounts}
                selectedLine={selectedLine}
                onSelectLine={selectLine}
                onIndicatorClick={() => setMutantsPanelOpen(true)}
                initialLine={selectedLine}
              />
              <EditorStatusBar
                path={file.path}
                lineCount={lines.length}
                language={language}
                size={file.size}
                selectedLine={selectedLine}
                mutantCount={file.mutants.length}
              />
            </>
          ) : file ? (
            <div className="p-6">
              <EmptyState
                icon={FileWarning}
                title={file.binary ? "Binary file" : "File too large to display"}
                description={
                  file.binary
                    ? "This file is not text and cannot be shown in the viewer."
                    : "Files above 512 KB are not loaded into the viewer to keep the page responsive."
                }
                action={
                  <Button asChild variant="outline" size="sm">
                    <a href={file.htmlUrl} target="_blank" rel="noreferrer noopener">
                      View on GitHub
                    </a>
                  </Button>
                }
              />
            </div>
          ) : null}
        </section>

        {file ? (
          <aside
            className="border-border hidden w-80 shrink-0 border-l lg:block"
            aria-label="Mutants"
          >
            {panelNode}
          </aside>
        ) : null}
      </div>

      {/* Mobile: floating mutants button + sheets */}
      {file ? (
        <Button
          size="sm"
          className="fixed right-4 bottom-4 z-30 shadow-lg lg:hidden"
          onClick={() => setMutantsPanelOpen(true)}
          data-testid="open-mutants-panel"
        >
          <Bug className="size-3.5" aria-hidden /> Mutants ({file.mutants.length})
        </Button>
      ) : null}

      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-border border-b">
            <SheetTitle className="text-sm">Files</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {treeNode(() => setTreeOpen(false))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={mutantsPanelOpen} onOpenChange={setMutantsPanelOpen}>
        <SheetContent side="bottom" className="h-[70vh] gap-0 p-0 lg:hidden">
          <SheetHeader className="border-border border-b">
            <SheetTitle className="text-sm">Mutants</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{panelNode}</div>
        </SheetContent>
      </Sheet>

      {file && selectedLine ? (
        <SuggestMutantDrawer
          key={`${commit.sha}:${file.path}:${selectedLine}`}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          project={{
            id: project.id,
            owner: project.owner,
            repo: project.repo,
            displayName: project.displayName,
          }}
          commitSha={commit.sha}
          filePath={file.path}
          language={language}
          lines={lines}
          selectedLine={selectedLine}
        />
      ) : null}
    </div>
  );
}
