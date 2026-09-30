import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  tone?: "default" | "warning" | "success" | "info" | "danger";
  /** Makes the tile a link (e.g. to the list filtered by this stat). */
  href?: string;
  /** Highlights a linked tile whose filter is applied. */
  active?: boolean;
  testId?: string;
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-sky-600 dark:text-sky-400",
  danger: "text-rose-600 dark:text-rose-400",
};

export function Stat({
  label,
  value,
  hint,
  className,
  tone = "default",
  href,
  active,
  testId,
}: StatProps) {
  const body = (
    <>
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className={cn("mt-0.5 font-mono text-xl font-semibold tabular-nums", TONE[tone])}>
        {value}
      </div>
      {hint ? <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div> : null}
    </>
  );
  const classes = cn("border-border bg-card rounded-lg border px-3 py-2.5", className);
  if (!href)
    return (
      <div className={classes} data-testid={testId}>
        {body}
      </div>
    );
  return (
    <Link
      href={href}
      className={cn(
        classes,
        "hover:bg-accent/50 block transition-colors",
        active && "border-ring ring-ring/30 ring-2",
      )}
      aria-current={active ? "true" : undefined}
      data-testid={testId}
    >
      {body}
    </Link>
  );
}
