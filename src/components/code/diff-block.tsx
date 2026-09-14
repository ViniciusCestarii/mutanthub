import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/shared/copy-button";

type LineKind = "add" | "del" | "hunk" | "meta" | "ctx";

function classify(line: string): LineKind {
  if (line.startsWith("+++") || line.startsWith("---")) return "meta";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  if (line.startsWith("diff ") || line.startsWith("index ")) return "meta";
  return "ctx";
}

const LINE_CLASS: Record<LineKind, string> = {
  add: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  del: "bg-rose-500/10 text-rose-800 dark:text-rose-200",
  hunk: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  meta: "text-muted-foreground",
  ctx: "",
};

interface DiffBlockProps {
  diff: string;
  className?: string;
  /** Show a copy-patch button in the top-right corner. */
  copyable?: boolean;
  maxHeightClass?: string;
}

/**
 * Renders a unified diff with per-line highlighting. Pure markup, so it works
 * in Server Components and never needs Monaco.
 */
export function DiffBlock({
  diff,
  className,
  copyable = true,
  maxHeightClass = "max-h-[480px]",
}: DiffBlockProps) {
  const lines = diff.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  return (
    <div className={cn("border-border bg-muted/30 relative rounded-md border", className)}>
      {copyable ? (
        <div className="absolute top-1 right-1 z-10">
          <CopyButton
            text={diff}
            label="Copy patch"
            className="bg-background/80 h-6 px-2 text-xs backdrop-blur"
          />
        </div>
      ) : null}
      <pre
        className={cn("overflow-auto py-2 font-mono text-xs leading-5", maxHeightClass)}
        data-testid="diff-block"
      >
        <code>
          {lines.map((line, i) => {
            const kind = classify(line);
            return (
              <span key={i} className={cn("block px-3 whitespace-pre", LINE_CLASS[kind])}>
                {line.length ? line : " "}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
