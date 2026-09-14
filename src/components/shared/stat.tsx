import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  tone?: "default" | "warning" | "success" | "info" | "danger";
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-sky-600 dark:text-sky-400",
  danger: "text-rose-600 dark:text-rose-400",
};

export function Stat({ label, value, hint, className, tone = "default" }: StatProps) {
  return (
    <div className={cn("border-border bg-card rounded-lg border px-3 py-2.5", className)}>
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className={cn("mt-0.5 font-mono text-xl font-semibold tabular-nums", TONE[tone])}>
        {value}
      </div>
      {hint ? <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div> : null}
    </div>
  );
}
