import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { routes } from "@/lib/routes";

interface BreadcrumbsProps {
  owner: string;
  repo: string;
  path: string;
  gitRef: string;
  pr?: number;
}

/** `owner/repo / dir / file` — every segment links to its directory at the same ref. */
export function Breadcrumbs({ owner, repo, path, gitRef, pr }: BreadcrumbsProps) {
  const segments = path ? path.split("/") : [];
  return (
    <nav aria-label="Path" className="flex min-w-0 items-center gap-1 font-mono text-xs">
      <Link
        href={routes.projectCode(owner, repo, undefined, { ref: gitRef, pr })}
        className="text-foreground shrink-0 font-medium hover:underline"
      >
        {owner}/{repo}
      </Link>
      {segments.map((segment, i) => {
        const segmentPath = segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={segmentPath} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
            {isLast ? (
              <span className="text-foreground truncate" aria-current="page">
                {segment}
              </span>
            ) : (
              <Link
                href={routes.projectCode(owner, repo, segmentPath, { ref: gitRef, pr })}
                className="text-muted-foreground hover:text-foreground truncate hover:underline"
              >
                {segment}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
