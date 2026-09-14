import Link from "next/link";
import { Bug } from "lucide-react";
import type { MutantListItem } from "@/server/repositories/mutant-repository";
import { summarizeValidations } from "@/domain/mutants/validation-summary";
import { routes } from "@/lib/routes";
import { relativeTime, shortSha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { UserChip } from "@/components/shared/user-chip";
import { MutationStatusBadge, OperatorBadge, ReviewStatusBadge } from "./status-badge";
import { ValidationDots } from "./validation-dots";

interface MutantTableProps {
  mutants: MutantListItem[];
  /** Hide the project column when all rows belong to one project. */
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

/** Dense, GitHub-like table of mutants used by /mutants, project pages, dashboard and profiles. */
export function MutantTable({
  mutants,
  showProject = true,
  emptyTitle = "No mutants found",
  emptyDescription,
  className,
}: MutantTableProps) {
  if (mutants.length === 0) {
    return <EmptyState icon={Bug} title={emptyTitle} description={emptyDescription} compact />;
  }
  return (
    <div className={cn("border-border overflow-x-auto rounded-lg border", className)}>
      <table className="w-full min-w-[720px] text-sm" data-testid="mutant-table">
        <thead className="bg-muted/50 text-muted-foreground text-left text-[11px] tracking-wide uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            {showProject ? <th className="px-3 py-2 font-medium">Project</th> : null}
            <th className="px-3 py-2 font-medium">File</th>
            <th className="px-3 py-2 font-medium">Mutation</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Validations</th>
            <th className="px-3 py-2 font-medium">Contributor</th>
            <th className="px-3 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {mutants.map((m) => {
            const summary = summarizeValidations(m.validations.map((v) => v.result));
            return (
              <tr
                key={m.id}
                className="hover:bg-muted/40"
                data-testid="mutant-row"
                data-mutant-id={m.id}
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  <Link
                    href={routes.mutant(m.id)}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    #{m.id}
                  </Link>
                </td>
                {showProject ? (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={routes.project(m.project.githubOwner, m.project.githubRepository)}
                      className="font-mono text-xs hover:underline"
                    >
                      {m.project.githubOwner}/{m.project.githubRepository}
                    </Link>
                  </td>
                ) : null}
                <td className="max-w-[240px] px-3 py-2">
                  <Link
                    href={routes.projectCode(
                      m.project.githubOwner,
                      m.project.githubRepository,
                      m.filePath,
                      {
                        ref: m.revision.commitSha,
                        line: m.startLine,
                      },
                    )}
                    className="block truncate font-mono text-xs hover:underline"
                    title={`${m.filePath}:${m.startLine} @ ${shortSha(m.revision.commitSha)}`}
                  >
                    {m.filePath}
                    <span className="text-muted-foreground">:{m.startLine}</span>
                  </Link>
                </td>
                <td className="max-w-[320px] px-3 py-2">
                  <Link
                    href={routes.mutant(m.id)}
                    className="block truncate font-medium hover:underline"
                    title={m.title}
                  >
                    {m.title}
                  </Link>
                  <OperatorBadge operator={m.mutationOperator} className="mt-1" />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <ReviewStatusBadge status={m.reviewStatus} />
                    <MutationStatusBadge status={m.mutationStatus} />
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <ValidationDots summary={summary} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <UserChip user={m.createdBy} size="xs" />
                </td>
                <td
                  className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap"
                  title={m.createdAt.toISOString()}
                >
                  {relativeTime(m.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
