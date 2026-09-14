import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shared/page-header";

export default function MutantLoading() {
  return (
    <PageContainer wide className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-3 w-full max-w-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </PageContainer>
  );
}
