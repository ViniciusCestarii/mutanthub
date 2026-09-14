import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section } from "@/components/shared/section";
import { DiffBlock } from "@/components/code/diff-block";
import { MonacoDiff } from "@/components/code/monaco-diff";
import { CopyButton } from "@/components/shared/copy-button";
import { languageForPath } from "@/components/code/language";
import { parseDiffStats } from "@/domain/mutants/diff";

interface DiffSectionProps {
  filePath: string;
  originalCode: string;
  mutatedCode: string;
  gitDiff: string;
  height?: number;
  compact?: boolean;
}

// TODO(future): add a "Download patch" button backed by GET /api/mutants/[id]/patch
// (text/x-diff). The gitDiff column already stores the exact patch text.

/** Original vs mutant: side-by-side Monaco diff and the unified patch. */
export function DiffSection({
  filePath,
  originalCode,
  mutatedCode,
  gitDiff,
  height = 220,
  compact,
}: DiffSectionProps) {
  const stats = parseDiffStats(gitDiff);
  const language = languageForPath(filePath);
  return (
    <Section
      title="Diff"
      description={
        <span className="font-mono">
          <span className="text-emerald-600 dark:text-emerald-400">+{stats.additions}</span>{" "}
          <span className="text-rose-600 dark:text-rose-400">-{stats.deletions}</span> · {language}
        </span>
      }
      actions={<CopyButton text={gitDiff} label="Copy patch" className="h-6 px-2 text-xs" />}
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      <Tabs defaultValue="side-by-side">
        <TabsList>
          <TabsTrigger value="side-by-side">Side by side</TabsTrigger>
          <TabsTrigger value="unified">Unified</TabsTrigger>
        </TabsList>
        <TabsContent value="side-by-side">
          <MonacoDiff
            original={originalCode}
            modified={mutatedCode}
            language={language}
            height={height}
            className="border-border overflow-hidden rounded-md border"
          />
        </TabsContent>
        <TabsContent value="unified" className="space-y-3">
          <DiffBlock diff={gitDiff} copyable={false} />
          <div className="grid gap-3 md:grid-cols-2">
            <SnippetBlock label="Original" code={originalCode} tone="del" />
            <SnippetBlock label="Mutant" code={mutatedCode} tone="add" />
          </div>
        </TabsContent>
      </Tabs>
    </Section>
  );
}

function SnippetBlock({ label, code, tone }: { label: string; code: string; tone: "add" | "del" }) {
  return (
    <div className="border-border rounded-md border">
      <div className="border-border text-muted-foreground border-b px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <pre
        className={`overflow-x-auto px-3 py-2 font-mono text-xs leading-5 ${
          tone === "add" ? "bg-emerald-500/5" : "bg-rose-500/5"
        }`}
        data-testid={tone === "add" ? "mutated-code" : "original-code"}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
