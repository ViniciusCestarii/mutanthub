import { Section } from "@/components/shared/section";
import { DiffTabs } from "./diff-tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { routes } from "@/lib/routes";
import { languageForPath } from "@/components/code/language";
import { parseDiffStats, splitUnifiedDiff } from "@/domain/mutants/diff";

interface DiffSectionProps {
  /** Enables the "Download patch" link (GET /api/mutants/[id]/patch). */
  mutantId?: number;
  filePath: string;
  originalCode: string;
  mutatedCode: string;
  gitDiff: string;
  height?: number;
  compact?: boolean;
}

/** Original vs mutant: side-by-side Monaco diff and the unified patch. */
export function DiffSection({
  mutantId,
  filePath,
  originalCode,
  mutatedCode,
  gitDiff,
  height = 220,
  compact,
}: DiffSectionProps) {
  const stats = parseDiffStats(gitDiff);
  const language = languageForPath(filePath);
  // The patch carries context lines and every hunk; the stored snippets only
  // cover the mutated block, so prefer the patch when there is one.
  const sides = splitUnifiedDiff(gitDiff) ?? { original: originalCode, modified: mutatedCode };
  return (
    <Section
      title="Diff"
      description={
        <span className="font-mono">
          <span className="text-emerald-600 dark:text-emerald-400">+{stats.additions}</span>{" "}
          <span className="text-rose-600 dark:text-rose-400">-{stats.deletions}</span> · {language}
        </span>
      }
      actions={
        <span className="flex items-center gap-1">
          <CopyButton text={gitDiff} label="Copy patch" className="h-6 px-2 text-xs" />
          {mutantId ? (
            <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <a href={routes.mutantPatch(mutantId)} download data-testid="download-patch">
                <Download className="size-3.5" aria-hidden /> Download patch
              </a>
            </Button>
          ) : null}
        </span>
      }
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      {mutatedCode.trim().length === 0 ? (
        <p className="text-muted-foreground mb-2 text-xs" data-testid="deletion-note">
          This mutant deletes the original lines without replacement.
        </p>
      ) : null}
      <DiffTabs
        original={sides.original}
        modified={sides.modified}
        language={language}
        height={height}
      />
    </Section>
  );
}
