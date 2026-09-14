import { Skeleton } from "@/components/ui/skeleton";

export default function CodeLoading() {
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col" data-testid="code-loading">
      <div className="border-border flex items-center gap-3 border-b px-3 py-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="ml-auto h-6 w-28" />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="border-border hidden w-64 shrink-0 space-y-2 border-r p-3 md:block">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3.5"
              style={{ width: `${50 + ((i * 23) % 45)}%`, marginLeft: (i % 3) * 12 }}
            />
          ))}
        </aside>
        <section className="flex-1 space-y-2 p-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5" style={{ width: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </section>
        <aside className="border-border hidden w-80 shrink-0 space-y-3 border-l p-3 lg:block">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </aside>
      </div>
    </div>
  );
}
