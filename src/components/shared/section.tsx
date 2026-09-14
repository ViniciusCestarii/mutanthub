import { cn } from "@/lib/utils";

interface SectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/** Compact titled block used throughout detail pages. */
export function Section({ title, description, actions, children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn("border-border bg-card rounded-lg border", className)}>
      <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
