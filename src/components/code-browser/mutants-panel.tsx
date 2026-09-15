"use client";

import Link from "next/link";
import { Bug, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MutationStatusBadge,
  OperatorBadge,
  ReviewStatusBadge,
} from "@/components/mutants/status-badge";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { BrowserMutant } from "./types";

interface MutantsPanelProps {
  owner: string;
  repo: string;
  filePath: string;
  mutants: BrowserMutant[];
  mutantsAtOtherRevisions: number;
  selectedLine: number | null;
  selectedLineText: string | null;
  onSelectLine: (line: number) => void;
  onSuggest: () => void;
  signedIn: boolean;
  signInHref: string;
  /** Pull request mode: whether the selected line is part of the PR diff. */
  pullRequest?: { number: number; fileInDiff: boolean; lineInDiff: boolean } | null;
}

function MutantItem({
  mutant,
  active,
  onClick,
}: {
  mutant: BrowserMutant;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li
      className={cn(
        "border-border bg-card rounded-md border p-2 text-xs transition-colors",
        active && "border-sky-500/50 bg-sky-500/5",
      )}
      data-testid="panel-mutant"
      data-mutant-id={mutant.id}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onClick}
          className="bg-muted text-muted-foreground hover:bg-muted/70 shrink-0 rounded px-1 font-mono text-[10px]"
          title="Jump to line"
        >
          L{mutant.startLine}
          {mutant.endLine !== mutant.startLine ? `–${mutant.endLine}` : ""}
        </button>
        <Link
          href={routes.mutant(mutant.id)}
          className="min-w-0 flex-1 leading-snug font-medium hover:underline"
        >
          <span className="text-muted-foreground font-mono">#{mutant.id}</span> {mutant.title}
        </Link>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <ReviewStatusBadge status={mutant.reviewStatus} />
        <MutationStatusBadge status={mutant.mutationStatus} />
        <OperatorBadge operator={mutant.mutationOperator} />
      </div>
      <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5">
        <Avatar className="size-4">
          <AvatarImage src={mutant.createdBy.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[8px]">
            {mutant.createdBy.githubUsername.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-mono">@{mutant.createdBy.githubUsername}</span>
        <span className="ml-auto">
          {mutant.validationCount} validation{mutant.validationCount === 1 ? "" : "s"}
        </span>
      </div>
    </li>
  );
}

/** Right-hand panel: mutants for the file plus the selected-line details. */
export function MutantsPanel({
  owner,
  repo,
  filePath,
  mutants,
  mutantsAtOtherRevisions,
  selectedLine,
  selectedLineText,
  onSelectLine,
  onSuggest,
  signedIn,
  signInHref,
  pullRequest = null,
}: MutantsPanelProps) {
  const onLine = selectedLine
    ? mutants.filter((m) => m.startLine <= selectedLine && selectedLine <= m.endLine)
    : [];

  return (
    <div className="flex h-full flex-col" data-testid="mutants-panel">
      <div className="border-border border-b p-3">
        <div className="text-muted-foreground mb-2 text-[11px] tracking-wide uppercase">
          Selected line
        </div>
        {selectedLine ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-500/10 px-1.5 font-mono text-xs font-medium text-sky-700 dark:text-sky-300">
                L{selectedLine}
              </span>
              <span className="text-muted-foreground text-xs">
                {onLine.length === 0
                  ? "No mutants on this line yet"
                  : `${onLine.length} mutant${onLine.length === 1 ? "" : "s"} on this line`}
              </span>
            </div>
            <pre
              className="border-border bg-muted/30 mt-2 max-h-24 overflow-auto rounded-md border px-2 py-1.5 font-mono text-[11px] leading-4 whitespace-pre"
              data-testid="selected-line-text"
            >
              {selectedLineText ?? ""}
            </pre>
            {pullRequest ? (
              pullRequest.lineInDiff ? (
                <p
                  className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-300"
                  data-testid="line-in-diff"
                >
                  Changed in PR #{pullRequest.number}. A mutant here will be scoped to the pull
                  request.
                </p>
              ) : (
                <p
                  className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                  data-testid="line-outside-diff"
                >
                  {pullRequest.fileInDiff
                    ? `Not changed by PR #${pullRequest.number}. The mutant will still be recorded against the PR but outside its diff.`
                    : `This file is not part of PR #${pullRequest.number}'s diff.`}
                </p>
              )
            ) : null}
            {signedIn ? (
              <Button
                className="mt-2 w-full"
                size="sm"
                onClick={onSuggest}
                data-testid="suggest-mutant"
              >
                <Plus className="size-3.5" aria-hidden /> Suggest mutant
              </Button>
            ) : (
              <div className="mt-2 space-y-1.5">
                <Button className="w-full" size="sm" disabled data-testid="suggest-mutant">
                  <Plus className="size-3.5" aria-hidden /> Suggest mutant
                </Button>
                <Link
                  href={signInHref}
                  className="text-muted-foreground block text-center text-xs underline underline-offset-2"
                >
                  Sign in to suggest a mutant
                </Link>
              </div>
            )}
            {onLine.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {onLine.map((m) => (
                  <MutantItem
                    key={m.id}
                    mutant={m}
                    active
                    onClick={() => onSelectLine(m.startLine)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Select a line in the editor to suggest a mutant.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold">
          Mutants{" "}
          <span className="text-muted-foreground font-mono text-xs font-normal">
            {mutants.length}
          </span>
        </h2>
        <span className="text-muted-foreground text-[11px]">this file · this commit</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {mutants.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-1 rounded-md border border-dashed px-3 py-6 text-center">
            <Bug className="text-muted-foreground size-4" aria-hidden />
            <p className="text-xs font-medium">No mutants for this file yet</p>
            <p className="text-muted-foreground text-[11px]">
              Select a line and suggest one you tested locally.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {mutants.map((m) => (
              <MutantItem
                key={m.id}
                mutant={m}
                active={
                  selectedLine != null && m.startLine <= selectedLine && selectedLine <= m.endLine
                }
                onClick={() => onSelectLine(m.startLine)}
              />
            ))}
          </ul>
        )}
        {mutantsAtOtherRevisions > 0 ? (
          <Link
            href={`${routes.projectMutants(owner, repo)}?file=${encodeURIComponent(filePath)}`}
            className="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 text-[11px] hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden />
            {mutantsAtOtherRevisions} mutant{mutantsAtOtherRevisions === 1 ? "" : "s"} exist for
            this file at other revisions
          </Link>
        ) : null}
      </div>
    </div>
  );
}
