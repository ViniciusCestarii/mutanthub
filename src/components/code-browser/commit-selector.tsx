"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { routes } from "@/lib/routes";
import { shortSha } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrowserCommit, BrowserRevision } from "./types";

interface CommitSelectorProps {
  owner: string;
  repo: string;
  path: string;
  defaultBranch: string;
  commit: BrowserCommit;
  revisions: BrowserRevision[];
}

/** Shows the browsed commit and lets the user jump to the head or to revisions that carry mutants. */
export function CommitSelector({
  owner,
  repo,
  path,
  defaultBranch,
  commit,
  revisions,
}: CommitSelectorProps) {
  const [open, setOpen] = useState(false);
  const options: Array<{ sha: string; label: string; hint: string; href: string }> = [];
  if (commit.headSha) {
    options.push({
      sha: commit.headSha,
      label: defaultBranch,
      hint: `head · ${shortSha(commit.headSha)}`,
      href: routes.projectCode(owner, repo, path || undefined, { ref: defaultBranch }),
    });
  }
  for (const rev of revisions) {
    if (rev.commitSha === commit.headSha) continue;
    options.push({
      sha: rev.commitSha,
      label: shortSha(rev.commitSha),
      hint: `${rev.mutantCount} mutant${rev.mutantCount === 1 ? "" : "s"}${rev.commitDate ? ` · ${new Date(rev.commitDate).toLocaleDateString()}` : ""}`,
      href: routes.projectCode(owner, repo, path || undefined, { ref: rev.commitSha }),
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-xs"
          data-testid="commit-selector"
          title={commit.sha}
        >
          <GitCommitHorizontal className="text-muted-foreground size-3.5" aria-hidden />
          {shortSha(commit.sha)}
          {commit.isHead ? <span className="text-muted-foreground">· {defaultBranch}</span> : null}
          <ChevronDown className="text-muted-foreground size-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="text-muted-foreground px-2 py-1.5 text-[11px] tracking-wide uppercase">
          Browse at
        </div>
        {options.length === 0 ? (
          <div className="text-muted-foreground px-2 py-2 text-xs">No other revisions known.</div>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const active = opt.sha === commit.sha;
              return (
                <li key={opt.sha}>
                  <Link
                    href={opt.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                      active && "bg-muted/60",
                    )}
                  >
                    <Check
                      className={cn("size-3.5", active ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="font-mono font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-auto truncate">{opt.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-border text-muted-foreground mt-1 border-t px-2 py-1.5 text-[11px]">
          Mutants always refer to the exact commit they were created against.
        </div>
      </PopoverContent>
    </Popover>
  );
}
