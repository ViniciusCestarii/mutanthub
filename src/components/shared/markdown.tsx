import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/** Server component: renders sanitized Markdown. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={cn("prose-compact text-sm leading-relaxed break-words", className)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
