import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/shared/copy-button";

interface CodeBlockProps {
  code: string;
  label?: string;
  className?: string;
  copyable?: boolean;
}

/** Displays a command or snippet as plain text. Commands are never executed. */
export function CodeBlock({ code, label, className, copyable = true }: CodeBlockProps) {
  return (
    <div className={cn("border-border bg-muted/30 rounded-md border", className)}>
      {label ? (
        <div className="border-border flex items-center justify-between border-b px-3 py-1">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {label}
          </span>
          {copyable ? <CopyButton text={code} className="h-6 px-2 text-xs" /> : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}
