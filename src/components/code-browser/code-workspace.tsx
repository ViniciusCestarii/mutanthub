"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, ExternalLink, FileWarning, FolderTree, GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CodeViewer } from "@/components/code/code-viewer";
import { languageForPath } from "@/components/code/language";
import { EmptyState } from "@/components/shared/empty-state";
import { useMediaQuery } from "@/hooks/use-media-query";
import { SuggestMutantDrawer } from "@/components/mutants/suggest-mutant-drawer";
import { routes } from "@/lib/routes";
import { rangeContaining } from "@/domain/pull-requests/diff-ranges";
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
  BrowserPullRequest,
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
  /** Present in pull request mode. */
  pullRequest?: BrowserPullRequest | null;
}

interface LineRange {
  start: number;
  end: number;
}

function rangeFromHash(hash: string): LineRange | null {
  const match = hash.match(/^#L(\d+)(?:-L?(\d+))?/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return { start, end: Math.max(start, end) };
}

function hashFor({ start, end }: LineRange): string {
  return end > start ? `#L${start}-L${end}` : `#L${start}`;
}

/**
 * The selected lines are React state mirrored into the URL hash (#L12 or
 * #L12-L20) so links are shareable. State (not the hash) is the source of
 * truth: a router refresh after a submission must not drop the selection or
 * close the drawer.
 */
function useSelectedRange(): [LineRange | null, (start: number, end?: number) => void] {
  const router = useRouter();
  const [range, setRange] = useState<LineRange | null>(null);
  // The last hash asked of the router: router.replace is async, so
  // window.location.hash lags behind it during a drag.
  const requestedHash = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => {
      requestedHash.current = window.location.hash;
      setRange(rangeFromHash(window.location.hash));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const selectRange = useCallback(
    (start: number, end = start) => {
      const next = { start, end: Math.max(start, end) };
      setRange(next);
      const hash = hashFor(next);
      // Through the router, not history.replaceState: a later refresh restores
      // the canonical URL, and a hash it never saw would reset the selection.
      if ((requestedHash.current ?? window.location.hash) !== hash) {
        requestedHash.current = hash;
        router.replace(`${window.location.pathname}${window.location.search}${hash}`, {
          scroll: false,
        });
      }
    },
    [router],
  );

  return [range, selectRange];
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
  pullRequest = null,
}: CodeWorkspaceProps) {
  const [selectedRange, selectRange] = useSelectedRange();
  const selectedLine = selectedRange?.start ?? null;
  const selectLine = useCallback((line: number) => selectRange(line), [selectRange]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [mutantsPanelOpen, setMutantsPanelOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const file = target.kind === "file" ? target.file : null;
  const content = file?.content ?? null;
  const lines = useMemo(
    () => (content ? content.replace(/\r\n?/g, "\n").split("\n") : []),
    [content],
  );
  const language = languageForPath(path);
  const changedBlock =
    selectedLine != null ? rangeContaining(selectedLine, pullRequest?.ranges ?? []) : null;
  // The whole selection must sit in the changed block, which also caps the drawer's end line.
  const lineInDiff =
    changedBlock != null && selectedRange != null && selectedRange.end <= changedBlock[1];

  const mutantRanges = useMemo(
    () => (file?.mutants ?? []).map((m) => ({ startLine: m.startLine, endLine: m.endLine })),
    [file?.mutants],
  );

  const currentUrl = routes.projectCode(project.owner, project.repo, path || undefined, {
    ref: gitRef,
    line: selectedLine ?? undefined,
  });
  const selectedLineText =
    selectedRange && lines.length
      ? lines.slice(selectedRange.start - 1, selectedRange.end).join("\n")
      : null;

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
      selectedEndLine={selectedRange?.end}
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
      pullRequest={
        pullRequest
          ? {
              number: pullRequest.number,
              fileInDiff: pullRequest.fileInDiff,
              lineInDiff,
              atHead: pullRequest.atHead,
              leaveHref: routes.projectCode(project.owner, project.repo, path, {
                ref: commit.sha,
                line: selectedLine ?? undefined,
              }),
            }
          : null
      }
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
        {pullRequest ? (
          <span
            className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-emerald-700 dark:text-emerald-300"
            data-testid="pull-request-notice"
          >
            <Link
              href={routes.projectPull(project.owner, project.repo, pullRequest.number)}
              className="font-medium hover:underline"
            >
              PR #{pullRequest.number}
            </Link>
            {pullRequest.atHead ? " · changed lines highlighted" : " · not at the PR head"}
            {!pullRequest.fileInDiff ? " · this file is not part of the diff" : ""}
          </span>
        ) : !commit.isHead ? (
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
                mutantRanges={mutantRanges}
                selectedLine={selectedLine}
                selectedEndLine={selectedRange?.end}
                onSelectLine={selectLine}
                onSelectRange={selectRange}
                onIndicatorClick={isDesktop ? undefined : () => setMutantsPanelOpen(true)}
                initialLine={selectedLine}
                changedRanges={pullRequest?.atHead ? pullRequest.ranges : undefined}
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
          key={`${commit.sha}:${file.path}:${selectedLine}-${selectedRange?.end}`}
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
          selectedEndLine={selectedRange?.end}
          pullRequestNumber={pullRequest?.atHead ? pullRequest.number : null}
          lineLimit={pullRequest?.atHead && changedBlock ? changedBlock[1] : null}
        />
      ) : null}
    </div>
  );
}
