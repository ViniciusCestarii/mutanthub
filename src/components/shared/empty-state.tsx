import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed text-center",
        compact ? "gap-1 px-4 py-6" : "gap-2 px-6 py-12",
        className,
      )}
    >
      {Icon ? <Icon className="text-muted-foreground size-5" aria-hidden /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-md text-xs">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
