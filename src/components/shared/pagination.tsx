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

function PageButton({
  disabled,
  href,
  children,
}: {
  disabled: boolean;
  href: string;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  );
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
        <PageButton disabled={page <= 1} href={hrefFor(page - 1)}>
          <ChevronLeft className="size-3.5" aria-hidden /> Prev
        </PageButton>
        <PageButton disabled={page >= totalPages} href={hrefFor(page + 1)}>
          Next <ChevronRight className="size-3.5" aria-hidden />
        </PageButton>
      </div>
    </div>
  );
}
