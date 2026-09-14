import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the href for a given page, preserving other filters. */
  hrefFor: (page: number) => string;
}

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="text-muted-foreground flex items-center justify-between text-xs">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-1">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={hrefFor(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            <ChevronLeft className="size-3.5" aria-hidden /> Prev
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
          <Link href={hrefFor(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
