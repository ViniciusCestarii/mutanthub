import Link from "next/link";
import { Copy, GitCommitHorizontal, History, TriangleAlert } from "lucide-react";
import type { MutantDetailView } from "@/server/services/mutant-service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import { relativeTime, shortSha } from "@/lib/format";

/** Commit drift, duplicate-of and possible-duplicate notices. */
export function MutantNotices({ view }: { view: MutantDetailView }) {
  const { mutant, isOlderRevision, headSha, duplicateCheck } = view;
  const hasPossible = duplicateCheck.exact.length > 0 || duplicateCheck.similar.length > 0;
  const drifted = mutant.driftStatus === "MOVED" || mutant.driftStatus === "GONE";
  if (!isOlderRevision && !mutant.duplicateOf && !hasPossible && !drifted) return null;

  return (
    <div className="space-y-2" data-testid="mutant-notices">
      {isOlderRevision && headSha ? (
        <Alert className="border-amber-500/40 bg-amber-500/5" data-testid="older-revision-notice">
          <History className="text-amber-600 dark:text-amber-400" />
          <AlertTitle>This mutant refers to an older revision.</AlertTitle>
          <AlertDescription>
            The project&apos;s default branch is now at{" "}
            <a
              href={routes.github.commit(
                mutant.project.githubOwner,
                mutant.project.githubRepository,
                headSha,
              )}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline underline-offset-2"
            >
              {shortSha(headSha)}
            </a>
            . Line numbers may no longer match the current code.
          </AlertDescription>
        </Alert>
      ) : null}

      {drifted ? (
        <Alert
          className={
            mutant.driftStatus === "GONE"
              ? "border-rose-500/40 bg-rose-500/5"
              : "border-amber-500/40 bg-amber-500/5"
          }
          data-testid="drift-notice"
          data-status={mutant.driftStatus}
        >
          <GitCommitHorizontal
            className={
              mutant.driftStatus === "GONE"
                ? "text-rose-600 dark:text-rose-400"
                : "text-amber-600 dark:text-amber-400"
            }
          />
          <AlertTitle>
            {mutant.driftStatus === "GONE"
              ? "The original code is no longer on the default branch."
              : `The original code moved to line ${mutant.driftLine ?? "?"} on the default branch.`}
          </AlertTitle>
          <AlertDescription>
            Checked against{" "}
            {mutant.driftCommitSha ? (
              <a
                href={routes.github.commit(
                  mutant.project.githubOwner,
                  mutant.project.githubRepository,
                  mutant.driftCommitSha,
                )}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline underline-offset-2"
              >
                {shortSha(mutant.driftCommitSha)}
              </a>
            ) : (
              "the default branch"
            )}
            {mutant.driftCheckedAt ? ` ${relativeTime(mutant.driftCheckedAt)}` : ""}.{" "}
            {mutant.driftStatus === "GONE" ? (
              <>
                If a test or a fix landed for this mutation,{" "}
                <a href="#killing-tests" className="underline underline-offset-2">
                  report the killing test
                </a>{" "}
                so the outcome can be verified.
              </>
            ) : (
              <>
                <Link
                  href={routes.projectCode(
                    mutant.project.githubOwner,
                    mutant.project.githubRepository,
                    mutant.filePath,
                    {
                      ref: mutant.driftCommitSha ?? undefined,
                      line: mutant.driftLine ?? undefined,
                    },
                  )}
                  className="underline underline-offset-2"
                >
                  Open it at the new location
                </Link>
                .
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {mutant.duplicateOf ? (
        <Alert data-testid="duplicate-of-notice">
          <Copy className="text-muted-foreground" />
          <AlertTitle>Marked as a duplicate</AlertTitle>
          <AlertDescription>
            This submission duplicates{" "}
            <Link
              href={routes.mutant(mutant.duplicateOf.id)}
              className="font-mono underline underline-offset-2"
            >
              #{mutant.duplicateOf.id}
            </Link>{" "}
            <span className="text-muted-foreground">({mutant.duplicateOf.title})</span>.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasPossible ? (
        <Alert
          className="border-amber-500/40 bg-amber-500/5"
          data-testid="possible-duplicate-notice"
        >
          <TriangleAlert className="text-amber-600 dark:text-amber-400" />
          <AlertTitle>Possible duplicate</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5">
              {duplicateCheck.exact.map((m) => (
                <li key={`e${m.id}`}>
                  <Link
                    href={routes.mutant(m.id)}
                    className="font-mono underline underline-offset-2"
                  >
                    #{m.id}
                  </Link>{" "}
                  {m.title}{" "}
                  <span className="text-muted-foreground">
                    — identical change at the same commit
                  </span>
                </li>
              ))}
              {duplicateCheck.similar.map((m) => (
                <li key={`s${m.id}`}>
                  <Link
                    href={routes.mutant(m.id)}
                    className="font-mono underline underline-offset-2"
                  >
                    #{m.id}
                  </Link>{" "}
                  {m.title}{" "}
                  <span className="text-muted-foreground">
                    — same change at commit{" "}
                    <span className="font-mono">{shortSha(m.revision.commitSha)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
